import { getBaseUrl } from '../initialData/regionUrls.js';
import { describe, it, expect } from 'vitest';

describe('platform region mapping logic', () => {
  it('is case-insensitive and returns US for "us"', () => {
    expect(getBaseUrl('us')).toBe('https://usiot.roborock.com');
  });

  it('returns EU for "EU"', () => {
    expect(getBaseUrl('EU')).toBe('https://euiot.roborock.com');
  });

  it('returns default US for unknown region', () => {
    expect(getBaseUrl('UNKNOWN')).toBe('https://usiot.roborock.com');
  });

  it('returns default US when region is undefined', () => {
    expect(getBaseUrl(undefined)).toBe('https://usiot.roborock.com');
  });
});
