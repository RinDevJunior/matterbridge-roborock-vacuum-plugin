import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FilterLogger } from '../share/filterLogger.js';
import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { createMockLogger } from './helpers/testUtils.js';

describe('FilterLogger', () => {
  let filterLogger: FilterLogger;
  let logger: AnsiLogger;

  beforeEach(() => {
    logger = createMockLogger();

    // Add the log method that dispatches to level-specific methods
    logger.log = vi.fn((level: LogLevel, message: string, ...parameters: unknown[]) => {
      switch (level) {
        case LogLevel.DEBUG:
          logger.debug(message, ...parameters);
          break;
        case LogLevel.INFO:
          logger.info(message, ...parameters);
          break;
        case LogLevel.WARN:
          logger.warn(message, ...parameters);
          break;
        case LogLevel.ERROR:
          logger.error(message, ...parameters);
          break;
        case LogLevel.NOTICE:
          logger.notice(message, ...parameters);
          break;
      }
    });

    filterLogger = new FilterLogger(logger);
  });

  it('should sanitize complex tokens with colons and equals signs', () => {
    // Create logger object with vi.fn() methods
    const objectToLog = {
      duid: 'YBqkooSOUKiJd5HiCFOAS',
      name: 'Roborock Qrevo Edge 5V1',
      attribute: null,
      activeTime: 1762346471,
      createTime: 1746940587,
      localKey: 'deElMR8S8wZEKmr2',
      runtimeEnv: null,
      timeZoneId: 'Asia/Saigon',
      iconUrl: '',
      productId: '2CjvhDFL7Q9NdJQmhE86zn',
      lon: null,
      lat: null,
      share: true,
      shareTime: 1768266016,
      online: true,
      fv: '02.29.08',
      pv: '1.0',
      roomId: null,
      tuyaUuid: null,
      tuyaMigrated: false,
      extra: '{}',
      setting: null,
      sn: 'RCIEBS50900224',
      cid: '',
      featureSet: '123456789ABCDEF0123456789ABCDEF',
      newFeatureSet: '00040040282834C9C2FA8F5C7EDEFFFE',
      deviceStatus: { 120: 0, 121: 8, 122: 100, 123: 110, 124: 209, 125: 82, 126: 67, 127: 63, 128: 0, 133: 1, 134: 0, 135: 0, 139: 0 },
      silentOtaSwitch: false,
      shareType: 'UNLIMITED_TIME',
      shareExpiredTime: null,
      f: false,
      rrHomeId: 5181380,
      rooms: [
        { id: 11100845, name: 'Kitchen' },
        { id: 11100849, name: 'Study' },
        { id: 11100842, name: 'Living room' },
        { id: 11100847, name: 'Bedroom' },
      ],
      serialNumber: 'RCIEBS50900224',
      scenes: [],
      data: {
        id: 'YBqkooSOUKiJd5HiCFOAS',
        firmwareVersion: '02.29.08',
        serialNumber: 'RCIEBS50900224',
        model: 'roborock.vacuum.a187',
        category: 'robot.vacuum.cleaner',
        batteryLevel: 100,
      },
      store: {
        username: 'abc@xyz.com',
        userData: {
          uid: 5172034,
          rruid: 'rr66ed372dc7f130',
          token: 'rr66ed372dc7f130:Z280JwKBBROBGNxs7Mclyg==:019bbefff10a7053b338ca65df32c84b',
          region: 'us',
          countrycode: '84',
          country: 'VN',
          nickname: 'Pmr6825748',
          avatarUrl: 'https://files.roborock.com/iot/default_avatar.png',
          tuya: null,
          rriot: {
            u: '2QJeXcriiLEgZTkHRRG1hF',
            s: '3Qo3aC',
            h: 'fEplTgzoNc',
            k: 'umPwRNyF',
            r: { r: 'US', a: 'https://api-us.roborock.com', m: 'ssl://mqtt-us-3.roborock.com:8883', l: 'https://wood-us.roborock.com' },
          },
          tuyaDeviceState: 0,
        },
        localKey: 'deElMR8S8wZEKmr2',
        pv: '1.0',
        model: 'roborock.vacuum.a187',
      },
    };
    filterLogger.info(`Device info: ${JSON.stringify(objectToLog)}`);

    expect(logger.info).toHaveBeenCalledTimes(1);
    const loggedMessage = vi.mocked(logger.info).mock.calls[0][0];
    expect(loggedMessage).not.toContain('rr66ed372dc7f130:Z280JwKBBROBGNxs7Mclyg==:019bbefff10a7053b338ca65df32c84b');
    expect(loggedMessage).toContain('[TOKEN_REDACTED]');
  });

  it('should redact sensitive information in various formats', () => {
    const objectToLog = {
      uid: 5172034,
      rruid: 'rr66ed372dc7f130',
      token: 'rr66ed372dc7f130:Z280JwKBBROBGNxs7Mclyg==:019bbefff10a7053b338ca65df32c84b',
      region: 'us',
      countrycode: '84',
      country: 'VN',
      nickname: 'Pmr6825748',
      avatarUrl: 'https://files.roborock.com/iot/default_avatar.png',
      tuya: null,
      rriot: {
        u: '2QJeXcriiLEgZTkHRRG1hF',
        s: '3Qo3aC',
        h: 'fEplTgzoNc',
        k: 'umPwRNyF',
        r: { r: 'US', a: 'https://api-us.roborock.com', m: 'ssl://mqtt-us-3.roborock.com:8883', l: 'https://wood-us.roborock.com' },
      },
      tuyaDeviceState: 0,
    };

    filterLogger.info(`User data: ${JSON.stringify(objectToLog)}`);

    expect(logger.info).toHaveBeenCalledTimes(1);
    const loggedMessage = vi.mocked(logger.info).mock.calls[0][0];
    expect(loggedMessage).not.toContain('rr66ed372dc7f130:Z280JwKBBROBGNxs7Mclyg==:019bbefff10a7053b338ca65df32c84b');
    expect(loggedMessage).not.toContain('rr66ed372dc7f130');
    expect(loggedMessage).not.toContain('Z280JwKBBROBGNxs7Mclyg==');
    expect(loggedMessage).not.toContain('019bbefff10a7053b338ca65df32c84b');
    expect(loggedMessage).toContain('[TOKEN_REDACTED]');
  });
});
