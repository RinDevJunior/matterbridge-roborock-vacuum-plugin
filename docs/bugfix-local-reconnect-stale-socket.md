# Bug Fix: LocalNetworkClient Stale Socket Race Condition on Reconnect

**File:** `src/roborockCommunication/local/localClient.ts`
**Date:** 2026-02-26
**Symptom:** Sau khi reconnect vì không nhận ping 15s, log xuất hiện 2 dòng "socket disconnected" liên tiếp và client không reconnect được.

---

## Root Cause

### Shared mutable state — `intentionalDisconnect` flag

`intentionalDisconnect` là field của class, được share giữa tất cả event handlers. Khi reconnect xảy ra, có race condition giữa `disconnect()` và `connect()`:

```
checkConnection() phát hiện không có ping 15s
│
├─ await this.disconnect()
│    ├─ intentionalDisconnect = true
│    ├─ socket.destroy()          ← schedules 'close' event ASYNC (chưa fire ngay)
│    └─ socket = undefined
│
└─ this.connect()                 ← chạy NGAY SAU disconnect()
     ├─ intentionalDisconnect = false   ← RESET TRƯỚC KHI close event fire!
     └─ this.socket = newSocket

--- async event loop ---
'close' event của OLD socket fire:
  onDisconnect() được gọi
  intentionalDisconnect = false  → KHÔNG early return (check fail)
  this.socket = newSocket        → destroy newSocket! ❌
  this.socket = undefined

'close' event của NEW socket (vừa bị destroy) fire:
  onDisconnect() được gọi lần nữa
  this.socket = undefined        → log "socket disconnected" lần 2 ❌
```

**Vấn đề cốt lõi:** `intentionalDisconnect` là time-based guard — phụ thuộc vào thứ tự thực thi. Node.js `socket.destroy()` emit `close` event bất đồng bộ, nên flag bị reset bởi `connect()` trước khi event fire.

---

## Fix: Identity-based Guard via Closure-captured Socket Reference

Thay vì dùng shared flag, mỗi event handler capture **socket instance cụ thể** tại thời điểm đăng ký qua closure. Handler chỉ xử lý event nếu socket đó còn là socket hiện tại.

```typescript
// connect()
this.socket = new Socket();
const socket = this.socket; // capture snapshot

socket.on('close', this.safeHandler(async (hadError: boolean) => {
  if (this.socket !== socket) return; // stale socket → ignore
  await this.onDisconnect(hadError);
}));
socket.on('error', this.safeHandler(async (error: Error) => {
  if (this.socket !== socket) return;
  await this.onError(error);
}));
socket.on('end', this.safeHandler(async () => {
  if (this.socket !== socket) return;
  await this.onEnd();
}));
```

### Timeline sau fix

```
connect() lần 1 → socketA → closure giữ ref đến socketA
connect() lần 2 → socketB → closure giữ ref đến socketB

'close' event của socketA fire (stale):
  socket (captured) = socketA
  this.socket       = socketB
  socketA !== socketB → return ✅ (ignore)

'close' event của socketB fire (legitimate):
  socket (captured) = socketB
  this.socket       = socketB
  socketB === socketB → process normally ✅
```

---

## Tại sao không fix `intentionalDisconnect`?

`intentionalDisconnect` có thể được fix bằng cách delay reset (ví dụ reset trong callback sau khi close event fire). Nhưng approach này vẫn fragile vì:

1. Phải biết chính xác khi nào close event fire để reset flag
2. Nếu thêm async step khác vào giữa, dễ break lại
3. Hard to reason about: phải track timing của nhiều async operations

Socket reference identity không phụ thuộc timing — chỉ hỏi "event này từ socket nào?" Rõ ràng và không thể sai.

---

## Kết quả

- Chỉ còn 1 dòng "socket disconnected" từ close event của socket cũ (bị suppress bởi reference check)
- Socket mới không bị destroy, reconnect hoàn thành bình thường
- `processHelloResponse()` set lại `checkConnectionInterval` sau khi hello thành công
