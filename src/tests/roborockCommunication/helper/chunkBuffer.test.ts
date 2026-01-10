import { ChunkBuffer } from '../../../roborockCommunication/helper/chunkBuffer';

describe('ChunkBuffer', () => {
  it('starts empty and appends/resets correctly', () => {
    const cb = new ChunkBuffer();
    expect(cb.get().length).toBe(0);

    const a = Buffer.from([1, 2]);
    cb.append(a);
    expect(cb.get()).toEqual(a);

    const b = Buffer.from([3, 4]);
    cb.append(b);
    expect(cb.get()).toEqual(Buffer.from([1, 2, 3, 4]));

    cb.reset();
    expect(cb.get().length).toBe(0);
  });
});
