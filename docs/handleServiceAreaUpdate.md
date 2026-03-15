# handleServiceAreaUpdate — Logic Explanation

Dispatcher xử lý sự kiện cập nhật vùng dọn dẹp từ robot, cập nhật hai Matter attribute: `selectedAreas` và `currentArea`.

---

## Apple Home — Cách đọc attribute

| selectedAreas | currentArea | Apple Home hiển thị      |
| ------------- | ----------- | ------------------------ |
| `[]`          | `null`      | "Preparing"              |
| `[1, 2]`      | `null`      | "Traveling to room"      |
| `[...]`       | `1`         | "Cleaning (Kitchen)"     |
| _(any)_       | _(any)_     | "Returning to dock" (\*) |

> (\*) "Returning to dock" do `operationalState = SeekingCharger`, không liên quan đến hai attribute trên.

**Quy tắc:** `selectedAreas` phải có data thì Apple Home mới hiện "Traveling to room". Nếu rỗng → luôn hiện "Preparing".

---

## Flow dispatch

```
message đến
    ├── state = Idle                              → [Nhánh 1]
    ├── cleaningInfo = null + CLEANING_STATES     → [Nhánh 2] handleCleaningWithoutInfo
    ├── cleaningInfo = null + state khác          → bỏ qua
    └── cleaningInfo có data                      → [Nhánh 3] happy path
```

**CLEANING_STATES** gồm:

- Predefined area: `RoomClean`, `ZoneClean`, `SpotCleaning`, `RoomMopping`, `ZoneMopping`, `RoomCleanMopCleaning`, `RoomCleanMopMopping`, `ZoneCleanMopCleaning`, `ZoneCleanMopMopping`
- General: `Paused`, `Cleaning`, `Mapping`, `CleanMopCleaning`, `CleanMopMopping`

---

## Nhánh 1 — Idle

Sync `selectedAreas` từ Roborock service về. Không động vào `currentArea`.

```
selectedAreas ← roborockService.getSelectedAreas()
currentArea   ← không đổi
```

---

## Nhánh 2 — `handleCleaningWithoutInfo`

Robot đang chạy nhưng server chưa gửi `cleaningInfo`. Logic:

```
selectedAreas ← robot attr ?? service ?? []

if clean_area = 0 || clean_time = 0
    → selectedAreas = selectedAreas, currentArea = null   (robot chưa bắt đầu dọn)

else if selectedAreas.length = 1
    → selectedAreas = selectedAreas, currentArea = selectedAreas[0]

else
    → selectedAreas = [], currentArea = null              (workaround)
```

| Điều kiện                               | selectedAreas | currentArea | Apple Home                |
| --------------------------------------- | ------------- | ----------- | ------------------------- |
| `clean_area=0` và `selectedAreas=[1,2]` | `[1, 2]`      | `null`      | "Traveling to room" ✅    |
| `clean_area=0` và `selectedAreas=[]`    | `[]`          | `null`      | "Preparing" ⚠️            |
| 1 room, đã bắt đầu                      | `[1]`         | `1`         | "Cleaning (Room)" ✅      |
| nhiều room, đã bắt đầu                  | `[]`          | `null`      | "Preparing" ✅ workaround |

> ⚠️ Nếu `clean_area=0` nhưng `getSelectedAreas()` trả về `[]` (chưa có thông tin phòng), Apple Home sẽ hiện "Preparing" thay vì "Traveling to room".

---

## Nhánh 3 — `resolveAreaFromCleaningInfo` (happy path)

Server gửi đủ thông tin. Resolve `currentArea` từ `segment_id` qua bảng ánh xạ `roomIndexMap`.

```
segment_id  ← cleaningInfo.segment_id ?? cleaningInfo.target_segment_id
mappedArea  ← roomIndexMap.getAreaId(segment_id, activeMapId)

if mappedArea found  →  currentArea = mappedArea
else                 →  currentArea = null
```

> `selectedAreas` không bị thay đổi — phụ thuộc vào giá trị được set từ nhánh trước đó.

| mappedArea | selectedAreas (giữ nguyên) | currentArea | Apple Home             |
| ---------- | -------------------------- | ----------- | ---------------------- |
| tìm thấy   | `[1, 2]`                   | `1`         | "Cleaning (Room)" ✅   |
| không thấy | `[1, 2]`                   | `null`      | "Traveling to room" ✅ |
| không thấy | `[]`                       | `null`      | "Preparing" ⚠️         |

---

## File liên quan

- `src/platformRunner.ts` — implementation
- `src/types/MessagePayloads.ts` — `ServiceAreaUpdateMessage`
- `src/roborockCommunication/enums/operationStatusCode.ts` — `OperationStatusCode`
