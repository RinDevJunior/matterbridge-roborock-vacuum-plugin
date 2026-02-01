import { describe, it, expect } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { RoborockMatterbridgePlatform } from '../module.js';
import { createMockLogger } from './helpers/testUtils.js';

describe('RoborockMatterbridgePlatform - version checks', () => {
  it('throws if verifyMatterbridgeVersion is undefined', () => {
    const mockMatterbridge: any = {
      matterbridgeVersion: '3.4.0',
      matterbridgePluginDirectory: '/tmp',
      matterbridgeDirectory: '/tmp',
      verifyMatterbridgeVersion: undefined,
    };

    const config: any = { name: 'Test Platform', persistDirectory: '/tmp' };

    expect(() => new RoborockMatterbridgePlatform(mockMatterbridge, createMockLogger(), config)).toThrow();
  });

  it('throws if verifyMatterbridgeVersion returns false', () => {
    const mockMatterbridge: any = {
      matterbridgeVersion: '3.4.0',
      matterbridgePluginDirectory: '/tmp',
      matterbridgeDirectory: '/tmp',
      verifyMatterbridgeVersion: () => false,
    };

    const config: any = { name: 'Test Platform', persistDirectory: '/tmp' };

    expect(() => new RoborockMatterbridgePlatform(mockMatterbridge, createMockLogger(), config)).toThrow();
  });
});
