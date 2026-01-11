import { ConfigurationError, MissingConfigurationError, InvalidConfigurationError, MissingCredentialsError, InvalidRegionError } from '../../errors/ConfigurationError.js';

describe('ConfigurationError', () => {
  describe('ConfigurationError', () => {
    it('should create error with message and metadata', () => {
      const error = new ConfigurationError('Invalid config', { source: 'file' });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.message).toBe('Invalid config');
      expect(error.code).toBe('CONFIG_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.metadata).toEqual({ source: 'file' });
    });

    it('should create error without metadata', () => {
      const error = new ConfigurationError('Config error');

      expect(error.message).toBe('Config error');
      expect(error.metadata).toBeUndefined();
    });
  });

  describe('MissingConfigurationError', () => {
    it('should create error for missing field', () => {
      const error = new MissingConfigurationError('apiKey');

      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.message).toBe('Required configuration field is missing: apiKey');
      expect(error.metadata).toEqual({
        reason: 'MISSING_FIELD',
        field: 'apiKey',
      });
    });

    it('should handle different field names', () => {
      const error = new MissingConfigurationError('database.host');

      expect(error.message).toBe('Required configuration field is missing: database.host');
      expect(error.metadata?.field).toBe('database.host');
    });
  });

  describe('InvalidConfigurationError', () => {
    it('should create error with field and value', () => {
      const error = new InvalidConfigurationError('port', 'abc');

      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.message).toBe('Invalid configuration value for field: port');
      expect(error.metadata).toEqual({
        reason: 'INVALID_VALUE',
        field: 'port',
        value: 'abc',
        expectedFormat: undefined,
      });
    });

    it('should include expected format', () => {
      const error = new InvalidConfigurationError('refreshInterval', -100, 'positive number');

      expect(error.message).toBe('Invalid configuration value for field: refreshInterval');
      expect(error.metadata).toEqual({
        reason: 'INVALID_VALUE',
        field: 'refreshInterval',
        value: -100,
        expectedFormat: 'positive number',
      });
    });

    it('should handle complex values', () => {
      const invalidValue = { nested: { data: true } };
      const error = new InvalidConfigurationError('settings', invalidValue, 'string or number');

      expect(error.metadata?.value).toEqual(invalidValue);
      expect(error.metadata?.expectedFormat).toBe('string or number');
    });
  });

  describe('MissingCredentialsError', () => {
    it('should create credentials error', () => {
      const error = new MissingCredentialsError();

      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.message).toBe('Authentication credentials are missing. Please provide username and password or verification code.');
      expect(error.metadata).toEqual({
        reason: 'MISSING_CREDENTIALS',
      });
    });

    it('should have correct error properties', () => {
      const error = new MissingCredentialsError();

      expect(error.code).toBe('CONFIG_ERROR');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('InvalidRegionError', () => {
    it('should create region error with valid regions list', () => {
      const validRegions = ['us', 'eu', 'cn'];
      const error = new InvalidRegionError('uk', validRegions);

      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.message).toBe('Invalid region: uk. Valid regions: us, eu, cn');
      expect(error.metadata).toEqual({
        reason: 'INVALID_REGION',
        region: 'uk',
        validRegions,
      });
    });

    it('should format message with single valid region', () => {
      const error = new InvalidRegionError('invalid', ['us']);

      expect(error.message).toBe('Invalid region: invalid. Valid regions: us');
    });

    it('should handle empty valid regions array', () => {
      const error = new InvalidRegionError('test', []);

      expect(error.message).toBe('Invalid region: test. Valid regions: ');
      expect(error.metadata?.validRegions).toEqual([]);
    });
  });

  describe('error hierarchy', () => {
    it('should maintain proper inheritance chain', () => {
      const errors = [
        new MissingConfigurationError('field'),
        new InvalidConfigurationError('field', 'value'),
        new MissingCredentialsError(),
        new InvalidRegionError('region', ['us']),
      ];

      errors.forEach((error) => {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(ConfigurationError);
      });
    });

    it('should all have CONFIG_ERROR code', () => {
      const errors = [
        new MissingConfigurationError('field'),
        new InvalidConfigurationError('field', 'value'),
        new MissingCredentialsError(),
        new InvalidRegionError('region', ['us']),
      ];

      errors.forEach((error) => {
        expect(error.code).toBe('CONFIG_ERROR');
        expect(error.statusCode).toBe(400);
      });
    });
  });
});
