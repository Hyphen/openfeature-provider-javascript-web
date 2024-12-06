import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HyphenClient } from '../src/hyphenClient';
import {
  type BeforeHookContext,
  ErrorCode,
  type EvaluationContext,
  type HookContext,
  ProviderEvents,
  TypeMismatchError,
} from '@openfeature/web-sdk';
import { type EvaluationParams, HyphenProvider } from '../src';
import type { Evaluation, EvaluationResponse } from '../src';

vi.mock('./hyphenClient');

const createMockEvaluation = (
  key: string,
  value: boolean | string | number | Record<string, any>,
  type: 'boolean' | 'string' | 'number' | 'object',
  reason: string = 'EVALUATED',
  errorMessage: string = '',
): Evaluation => ({
  key,
  value,
  type,
  reason,
  errorMessage,
});

describe('HyphenProvider', () => {
  const publicKey = 'test-public-key';
  const options = {
    horizonServerUrls: ['https://test-server.com'],
    application: 'test-app',
    environment: 'test-env',
  };
  const mockContext: EvaluationContext = {
    targetingKey: 'test-key',
    application: 'test-app',
    environment: 'test-env',
  };
  const mockLogger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };

  let provider: HyphenProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new HyphenProvider(publicKey, options);
  });

  describe('Constructor', () => {
    it('should throw an error if application is missing', () => {
      expect(() => new HyphenProvider(publicKey, { ...options, application: '' })).toThrowError(
        'Application is required',
      );
    });

    it('should throw an error if environment is missing', () => {
      expect(() => new HyphenProvider(publicKey, { ...options, environment: '' })).toThrowError(
        'Environment is required',
      );
    });
  });

  describe('onContextChange', () => {
    it('should update the cache when newContext has a targetingKey', async () => {
      const mockNewContext: EvaluationContext = {
        targetingKey: 'new-key',
        application: 'test-app',
        environment: 'test-env',
      };

      const mockEvaluationResponse: EvaluationResponse = {
        toggles: {
          'flag-key': createMockEvaluation('flag-key', true, 'boolean'),
        },
      };

      const evaluateSpy = vi.spyOn(HyphenClient.prototype, 'evaluate').mockResolvedValue(mockEvaluationResponse);

      await provider.onContextChange?.(mockContext, mockNewContext);

      expect(evaluateSpy).toHaveBeenCalledWith(mockNewContext);
      expect(provider.cache).toEqual(mockEvaluationResponse.toggles);
    });

    it('should emit an error event if an error occurs during evaluation', async () => {
      const mockNewContext: EvaluationContext = {
        targetingKey: 'new-key',
        application: 'test-app',
        environment: 'test-env',
      };

      const error = new Error('Evaluation failed');
      const evaluateSpy = vi.spyOn(HyphenClient.prototype, 'evaluate').mockRejectedValue(error);
      const emitSpy = vi.spyOn(provider.events, 'emit');

      await provider.onContextChange?.(mockContext, mockNewContext);

      expect(evaluateSpy).toHaveBeenCalledWith(mockNewContext);
      expect(emitSpy).toHaveBeenCalledWith(ProviderEvents.Error, error);
    });
  });

  describe('Hooks', () => {
    it('should execute beforeHook and modify the context', async () => {
      const mockHookContext: BeforeHookContext = {
        context: {
          targetingKey: 'test-key',
          application: 'test-app',
          environment: 'test-env',
        },
        flagKey: '',
        defaultValue: '',
        flagValueType: 'boolean',
        clientMetadata: {
          providerMetadata: {
            name: 'hyphen',
          },
        },
        providerMetadata: {
          name: 'hyphen',
        },
        logger: mockLogger,
      };
      const result = await provider.beforeHook(mockHookContext);

      expect(result.application).toBe(options.application);
      expect(result.environment).toBe(options.environment);
      expect(result.targetingKey).toBe('test-key');
    });

    it('should log errors in errorHook', async () => {
      const mockLogger = { error: vi.fn() };
      const hookContext: HookContext = { logger: mockLogger } as any;

      await provider.errorHook(hookContext, new Error('Test error'));

      expect(mockLogger.error).toHaveBeenCalledWith('Error', 'Test error');
    });

    it('should log the error as-is if it is not an instance of Error', async () => {
      const mockLogger = { error: vi.fn() };
      const hookContext: HookContext = { logger: mockLogger } as any;

      const nonErrorValue = 'string error';

      await provider.errorHook(hookContext, nonErrorValue);

      expect(mockLogger.error).toHaveBeenCalledWith('Error', nonErrorValue);
    });

    it('should log usage in finallyHook', async () => {
      const mockLogger = { info: vi.fn() };
      const hookContext: HookContext = { logger: mockLogger } as any;

      await provider.finallyHook(hookContext);

      expect(mockLogger.info).toHaveBeenCalledWith('logging usage');
    });
  });

  describe('initialize', () => {
    it('should initialize and cache evaluations', async () => {
      const mockEvaluationResponse: EvaluationResponse = {
        toggles: {
          'flag-key': createMockEvaluation('flag-key', true, 'boolean'),
        },
      };

      vi.spyOn(HyphenClient.prototype, 'evaluate').mockResolvedValue(mockEvaluationResponse);

      const spyEmit = vi.spyOn(provider.events, 'emit');

      await provider.initialize(mockContext);

      expect(provider.cache).toEqual(mockEvaluationResponse.toggles);
      expect(spyEmit).toHaveBeenCalledWith(ProviderEvents.Ready);
    });

    it('should emit an error event if initialization fails', async () => {
      const error = new Error('Initialization failed');
      vi.spyOn(HyphenClient.prototype, 'evaluate').mockRejectedValue(error);

      const spyEmit = vi.spyOn(provider.events, 'emit');

      await provider.initialize(mockContext);

      expect(spyEmit).toHaveBeenCalledWith(ProviderEvents.Error, error);
    });
  });

  describe('validateFlagType', () => {
    it('should throw a TypeMismatchError when the value cannot be parsed as a number', () => {
      const invalidValue = 'not-a-number';
      const type = 'number';

      expect(() => {
        provider['validateFlagType'](type, invalidValue);
      }).toThrowError(new TypeMismatchError(`default value does not match type ${type}`));
    });

    it('should throw a TypeMismatchError when the value cannot be parsed as an object', () => {
      const invalidValue = 'not-json';
      const type = 'object';

      expect(() => {
        provider['validateFlagType'](type, invalidValue);
      }).toThrowError(new TypeMismatchError(`default value does not match type ${type}`));
    });
  });

  describe('getEvaluationParseError', () => {
    it('should log an error when evaluation is not found', () => {
      const params: EvaluationParams<boolean> = {
        flagKey: 'missing-flag',
        evaluation: undefined,
        expectedType: 'boolean',
        value: false,
        logger: mockLogger,
      };

      const result = provider['getEvaluationParseError'](params);

      expect(mockLogger.error).toHaveBeenCalledWith('Flag missing-flag not found in evaluation response.');
      expect(result).toEqual({
        value: false,
        errorCode: ErrorCode.FLAG_NOT_FOUND,
      });
    });

    it('should log an error and return ResolutionDetails when evaluation has an errorMessage', () => {
      const params: EvaluationParams<boolean> = {
        flagKey: 'flag-with-error',
        evaluation: {
          key: 'flag-with-error',
          value: false,
          type: 'boolean',
          reason: 'EVALUATED',
          errorMessage: 'Some error occurred',
        },
        expectedType: 'boolean',
        value: false,
        logger: mockLogger,
      };

      const result = provider['getEvaluationParseError'](params);

      expect(mockLogger.error).toHaveBeenCalledWith('Error evaluating flag flag-with-error: Some error occurred');
      expect(result).toEqual({
        value: false,
        errorMessage: 'Some error occurred',
        errorCode: ErrorCode.GENERAL,
      });
    });
  });

  describe('resolveBooleanEvaluation', () => {
    it('should return a boolean evaluation', () => {
      provider.cache['flag-key'] = createMockEvaluation('flag-key', true, 'boolean');

      const result = provider.resolveBooleanEvaluation('flag-key', false, mockContext, mockLogger);

      expect(result).toEqual({
        value: true,
        variant: 'true',
        reason: 'EVALUATED',
      });
    });

    it('should return an error if the flag type mismatches', () => {
      provider.cache['flag-key'] = createMockEvaluation('flag-key', 'not-a-boolean', 'string');

      const result = provider.resolveBooleanEvaluation('flag-key', false, mockContext, mockLogger);

      expect(result).toEqual({
        value: false,
        reason: 'ERROR',
        errorCode: 'TYPE_MISMATCH',
      });
    });
  });

  describe('resolveStringEvaluation', () => {
    it('should return a string evaluation', () => {
      provider.cache['flag-key'] = createMockEvaluation('flag-key', 'test-value', 'string');

      const result = provider.resolveStringEvaluation('flag-key', 'default', mockContext, mockLogger);

      expect(result).toEqual({
        value: 'test-value',
        variant: 'test-value',
        reason: 'EVALUATED',
      });
    });
  });

  describe('resolveNumberEvaluation', () => {
    it('should return a number evaluation', () => {
      provider.cache['flag-key'] = createMockEvaluation('flag-key', 42, 'number');

      const result = provider.resolveNumberEvaluation('flag-key', 0, mockContext, mockLogger);

      expect(result).toEqual({
        value: 42,
        variant: '42',
        reason: 'EVALUATED',
      });
    });
  });

  describe('resolveObjectEvaluation', () => {
    it('should return an object evaluation', () => {
      const mockObjectValue = { key: 'value' };
      provider.cache['flag-key'] = createMockEvaluation('flag-key', JSON.stringify(mockObjectValue), 'object');

      const result = provider.resolveObjectEvaluation('flag-key', {}, mockContext, mockLogger);

      expect(result).toEqual({
        value: mockObjectValue,
        variant: JSON.stringify(mockObjectValue),
        reason: 'EVALUATED',
      });
    });
  });

  describe('validateContext', () => {
    it('should throw an error if context is missing required fields', () => {
      expect(() => provider['validateContext'](null as any)).toThrowError('Evaluation context is required');
      expect(() => provider['validateContext']({ targetingKey: 'key' } as any)).toThrowError(
        'application is required',
      );
      expect(() => provider['validateContext']({ application: 'test' } as any)).toThrowError(
        'targetingKey is required',
      );
      expect(() => provider['validateContext']({ targetingKey: 'key', application: 'test' } as any)).toThrowError(
        'environment is required',
      );
    });

    it('should return the context if all required fields are present', () => {
      const result = provider['validateContext']({
        targetingKey: 'key',
        application: 'test',
        environment: 'test-env',
      } as any);

      expect(result).toEqual({
        targetingKey: 'key',
        application: 'test',
        environment: 'test-env',
      });
    });
  });
});
