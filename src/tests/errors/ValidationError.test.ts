import { ValidationError, InvalidParameterError, OutOfRangeError, MissingParameterError, InvalidFormatError } from '../../errors/ValidationError.js';

describe('ValidationError', () => {
  describe('ValidationError', () => {
    it('should create error with message and metadata', () => {
      const error = new ValidationError('Validation failed', { field: 'username' });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.metadata).toEqual({ field: 'username' });
    });

    it('should create error without metadata', () => {
      const error = new ValidationError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.metadata).toBeUndefined();
    });
  });

  describe('InvalidParameterError', () => {
    it('should create error with parameter name and value', () => {
      const error = new InvalidParameterError('age', -5);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Invalid parameter: age. ');
      expect(error.metadata).toEqual({
        reason: 'INVALID_PARAMETER',
        parameterName: 'age',
        value: -5,
        validationReason: undefined,
      });
    });

    it('should include validation reason', () => {
      const error = new InvalidParameterError('email', 'invalid-email', 'must be valid email format');

      expect(error.message).toBe('Invalid parameter: email. must be valid email format');
      expect(error.metadata).toEqual({
        reason: 'INVALID_PARAMETER',
        parameterName: 'email',
        value: 'invalid-email',
        validationReason: 'must be valid email format',
      });
    });

    it('should handle complex parameter values', () => {
      const complexValue = { nested: { data: [1, 2, 3] } };
      const error = new InvalidParameterError('config', complexValue, 'must be string');

      expect(error.metadata?.value).toEqual(complexValue);
      expect(error.metadata?.validationReason).toBe('must be string');
    });
  });

  describe('OutOfRangeError', () => {
    it('should create error with range details', () => {
      const error = new OutOfRangeError('temperature', 150, -20, 100);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Parameter temperature is out of range. Expected: -20-100, got: 150');
      expect(error.metadata).toEqual({
        reason: 'OUT_OF_RANGE',
        parameterName: 'temperature',
        value: 150,
        min: -20,
        max: 100,
      });
    });

    it('should handle positive ranges', () => {
      const error = new OutOfRangeError('port', 70000, 1, 65535);

      expect(error.message).toBe('Parameter port is out of range. Expected: 1-65535, got: 70000');
      expect(error.metadata?.min).toBe(1);
      expect(error.metadata?.max).toBe(65535);
    });

    it('should handle values below minimum', () => {
      const error = new OutOfRangeError('percentage', -10, 0, 100);

      expect(error.message).toBe('Parameter percentage is out of range. Expected: 0-100, got: -10');
      expect(error.metadata?.value).toBe(-10);
    });
  });

  describe('MissingParameterError', () => {
    it('should create error for missing parameter', () => {
      const error = new MissingParameterError('username');

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Required parameter is missing: username');
      expect(error.metadata).toEqual({
        reason: 'MISSING_PARAMETER',
        parameterName: 'username',
      });
    });

    it('should handle different parameter names', () => {
      const error = new MissingParameterError('device.id');

      expect(error.message).toBe('Required parameter is missing: device.id');
      expect(error.metadata?.parameterName).toBe('device.id');
    });
  });

  describe('InvalidFormatError', () => {
    it('should create error with data and expected format', () => {
      const error = new InvalidFormatError('abc-123', 'UUID v4');

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Invalid data format. Expected: UUID v4');
      expect(error.metadata).toEqual({
        reason: 'INVALID_FORMAT',
        data: 'abc-123',
        expectedFormat: 'UUID v4',
      });
    });

    it('should handle date format errors', () => {
      const error = new InvalidFormatError('2024/13/45', 'YYYY-MM-DD');

      expect(error.message).toBe('Invalid data format. Expected: YYYY-MM-DD');
      expect(error.metadata?.data).toBe('2024/13/45');
      expect(error.metadata?.expectedFormat).toBe('YYYY-MM-DD');
    });

    it('should handle JSON format errors', () => {
      const invalidJson = '{ invalid json }';
      const error = new InvalidFormatError(invalidJson, 'valid JSON');

      expect(error.metadata?.data).toBe(invalidJson);
      expect(error.metadata?.expectedFormat).toBe('valid JSON');
    });
  });

  describe('error hierarchy', () => {
    it('should maintain proper inheritance chain', () => {
      const errors = [
        new InvalidParameterError('param', 'value'),
        new OutOfRangeError('param', 10, 0, 5),
        new MissingParameterError('param'),
        new InvalidFormatError('data', 'format'),
      ];

      errors.forEach((error) => {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(ValidationError);
      });
    });

    it('should all have VALIDATION_ERROR code', () => {
      const errors = [
        new InvalidParameterError('param', 'value'),
        new OutOfRangeError('param', 10, 0, 5),
        new MissingParameterError('param'),
        new InvalidFormatError('data', 'format'),
      ];

      errors.forEach((error) => {
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.statusCode).toBe(400);
      });
    });
  });
});
