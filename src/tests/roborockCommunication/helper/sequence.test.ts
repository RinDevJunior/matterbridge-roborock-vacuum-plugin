import { describe, it, expect } from 'vitest';
import { Sequence } from '../../../roborockCommunication/helper/sequence';

describe('Sequence', () => {
  it('should initialize with min and max values', () => {
    const sequence = new Sequence(1, 10);
    expect(sequence).toBeDefined();
  });

  it('should return incrementing values starting from min', () => {
    const sequence = new Sequence(1, 5);

    expect(sequence.next()).toBe(1);
    expect(sequence.next()).toBe(2);
    expect(sequence.next()).toBe(3);
    expect(sequence.next()).toBe(4);
    expect(sequence.next()).toBe(5);
  });

  it('should wrap around to min after reaching max', () => {
    const sequence = new Sequence(1, 3);

    expect(sequence.next()).toBe(1);
    expect(sequence.next()).toBe(2);
    expect(sequence.next()).toBe(3);
    expect(sequence.next()).toBe(1); // Wraps around
    expect(sequence.next()).toBe(2);
  });

  it('should handle single value range', () => {
    const sequence = new Sequence(5, 5);

    expect(sequence.next()).toBe(5);
    expect(sequence.next()).toBe(5); // Wraps immediately
    expect(sequence.next()).toBe(5);
  });

  it('should handle large ranges', () => {
    const sequence = new Sequence(1000, 1005);

    expect(sequence.next()).toBe(1000);
    expect(sequence.next()).toBe(1001);
    expect(sequence.next()).toBe(1002);
    expect(sequence.next()).toBe(1003);
    expect(sequence.next()).toBe(1004);
    expect(sequence.next()).toBe(1005);
    expect(sequence.next()).toBe(1000); // Wraps
  });

  it('should wrap around immediately when current exceeds max', () => {
    const sequence = new Sequence(10, 12);

    sequence.next(); // 10
    sequence.next(); // 11
    sequence.next(); // 12

    // Now current is 13, which is > max, so should wrap
    expect(sequence.next()).toBe(10);
  });
});
