import { describe, it, expect, vi, beforeEach } from 'vitest';
import hash from 'object-hash';
import { HyphenClient } from '../src/hyphenClient';
import {
  type BeforeHookContext,
  ErrorCode,
  EvaluationContext,
  type HookContext,
  TypeMismatchError,
} from '@openfeature/web-sdk';
import { type EvaluationParams, type HyphenEvaluationContext, HyphenProvider } from '../src';
import type { Evaluation, EvaluationResponse } from '../src';
import lscache from 'lscache';

vi.mock('./hyphenClient');
vi.mock('../src/config', () => ({
  horizonEndpoints: {
    evaluate: 'https://mock-horizon-url.com',
    telemetry: 'https://mock-telemetry-url.com',
  },
}));
vi.mock('lscache', () => {
  const store = new Map<string, any>();

  return {
    default: {
      set: vi.fn((key: string, value: any, ttlMinutes: number) => {
        const expirationTime = Date.now() + ttlMinutes * 60 * 1000;
        store.set(key, { value, expirationTime });
      }),
      get: vi.fn((key: string) => {
        const item = store.get(key);
        if (item && item.expirationTime > Date.now()) {
          return item.value;
        }
        store.delete(key);
        return null;
      }),
      flush: vi.fn(() => store.clear()),
    },
  };
});

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
    lscache.flush();
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
    it('should delete the after hook if enableToggleUsage is false', () => {
      const optionsWithToggleDisabled = {
        ...options,
        enableToggleUsage: false,
      };

      const providerWithToggleDisabled = new HyphenProvider(publicKey, optionsWithToggleDisabled);

      expect(providerWithToggleDisabled.hooks.some((hook) => hook.after)).toBe(false);
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
      const mockLogger = { debug: vi.fn() };
      const hookContext: HookContext = { logger: mockLogger } as any;

      await provider.errorHook(hookContext, new Error('Test error'));
      expect(mockLogger.debug).toHaveBeenCalledWith('Error', 'Test error');
    });

    it('should log the error directly if it is not an instance of Error', async () => {
      const mockLogger = { debug: vi.fn() };
      const hookContext: HookContext = { logger: mockLogger } as any;
      const nonError = 'Some non-error value';

      await provider.errorHook(hookContext, nonError);
      expect(mockLogger.debug).toHaveBeenCalledWith('Error', nonError);
    });

    it('should log payload details in afterHook', async () => {
      const mockLogger = { debug: vi.fn() };

      vi.spyOn(HyphenClient.prototype, 'postTelemetry').mockResolvedValue(undefined);

      const hookContext: HookContext = {
        logger: mockLogger,
        flagValueType: 'boolean',
        context: {},
      } as any;

      const evaluationDetails: any = {
        flagKey: 'test-flag',
        value: true,
        reason: 'mock-reason',
      };

      await provider.afterHook(hookContext, evaluationDetails);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Payload sent to postTelemetry:',
        JSON.stringify({
          context: hookContext.context,
          data: {
            toggle: {
              key: evaluationDetails.flagKey,
              value: evaluationDetails.value,
              type: hookContext.flagValueType,
              reason: evaluationDetails.reason,
            },
          },
        }),
      );
    });

    it('should log an error and rethrow it if postTelemetry fails', async () => {
      const mockLogger = { debug: vi.fn() };

      const postTelemetryError = new Error('Failed to send telemetry');
      vi.spyOn(HyphenClient.prototype, 'postTelemetry').mockRejectedValue(postTelemetryError);

      const hookContext: HookContext = {
        logger: mockLogger,
        flagValueType: 'boolean',
        context: {},
      } as any;

      const evaluationDetails: any = {
        flagKey: 'test-flag',
        value: true,
        reason: 'mock-reason',
      };

      await expect(provider.afterHook(hookContext, evaluationDetails)).rejects.toThrow(postTelemetryError);

      expect(mockLogger.debug).toHaveBeenCalledWith('Unable to log usage.', postTelemetryError);
    });
  });

  describe('generateCacheKey', () => {
    it('should use custom generateCacheKey function if provided', () => {
      const customGenerateCacheKey = vi.fn(() => 'custom-key');
      const providerWithCustomKey = new HyphenProvider(publicKey, {
        ...options,
        cache: { generateCacheKey: customGenerateCacheKey },
      });

      const cacheKey = providerWithCustomKey['generateCacheKey'](mockContext as any);
      expect(customGenerateCacheKey).toHaveBeenCalledWith(mockContext);
      expect(cacheKey).toEqual('custom-key');
    });
  });

  describe('initialize with hashed cache key', () => {
    it('should store evaluation response in cache with hashed key', async () => {
      const mockEvaluationResponse: EvaluationResponse = {
        toggles: {
          'flag-key': createMockEvaluation('flag-key', true, 'boolean'),
        },
      };

      vi.spyOn(HyphenClient.prototype, 'evaluate').mockResolvedValue(mockEvaluationResponse);

      await provider.initialize(mockContext);

      const cacheKey = hash(mockContext);
      expect(lscache.set).toHaveBeenCalledWith(cacheKey, mockEvaluationResponse.toggles, 1);

      const cachedValue = lscache.get(cacheKey);
      expect(cachedValue).toEqual(mockEvaluationResponse.toggles);
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

  describe('onContextChange with hashed cache key', () => {
    it('should store new context evaluations in cache with hashed key', async () => {
      const mockEvaluationResponse: EvaluationResponse = {
        toggles: {
          'flag-key': createMockEvaluation('flag-key', false, 'boolean'),
        },
      };

      vi.spyOn(HyphenClient.prototype, 'evaluate').mockResolvedValue(mockEvaluationResponse);

      const newContext = { ...mockContext, targetingKey: 'new-key' };
      await provider.onContextChange?.(mockContext, newContext);

      const cacheKey = hash(newContext);
      const cachedValue = lscache.get(cacheKey);
      expect(cachedValue).toEqual(mockEvaluationResponse.toggles);
    });
  });

  describe('getEvaluation with hashed cache key', () => {
    it('should retrieve cached evaluation using hashed key', () => {
      const mockEvaluationResponse: EvaluationResponse = {
        toggles: {
          'flag-key': createMockEvaluation('flag-key', 'value', 'string'),
        },
      };

      const cacheKey = hash(mockContext);
      lscache.set(cacheKey, mockEvaluationResponse.toggles, 1);

      const result = provider['getEvaluation']({
        flagKey: 'flag-key',
        value: 'default',
        expectedType: 'string',
        context: mockContext,
        logger: mockLogger,
      });

      expect(result).toEqual({
        value: 'value',
        variant: 'value',
        reason: 'EVALUATED',
      });
    });

    it('should return the default value and log an error when the requested flag is not found in the cache', () => {
      lscache.flush();

      const result = provider['getEvaluation']({
        flagKey: 'missing-key',
        value: 'default',
        expectedType: 'string',
        context: mockContext,
        logger: mockLogger,
      });

      expect(result).toEqual({
        value: 'default',
        errorCode: 'FLAG_NOT_FOUND',
      });
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

      expect(mockLogger.debug).toHaveBeenCalledWith('Flag missing-flag not found in evaluation response.');
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

      expect(mockLogger.debug).toHaveBeenCalledWith('Error evaluating flag flag-with-error: Some error occurred');
      expect(result).toEqual({
        value: false,
        errorMessage: 'Some error occurred',
        errorCode: ErrorCode.GENERAL,
      });
    });
  });

  describe('resolveBooleanEvaluation', () => {
    it('should return a boolean evaluation', () => {
      const mockEvaluationResponse: EvaluationResponse = {
        toggles: {
          'flag-key': createMockEvaluation('flag-key', true, 'boolean'),
        },
      };

      vi.spyOn(HyphenClient.prototype, 'evaluate').mockResolvedValue(mockEvaluationResponse);
      const cacheKey = hash(mockContext);
      lscache.set(cacheKey, mockEvaluationResponse.toggles, 1);
      const result = provider.resolveBooleanEvaluation('flag-key', false, mockContext, mockLogger);

      expect(result).toEqual({
        value: true,
        variant: 'true',
        reason: 'EVALUATED',
      });
    });

    it('should return an error if the flag type mismatches', () => {
      const mockEvaluationResponse: EvaluationResponse = {
        toggles: {
          'flag-key': createMockEvaluation('flag-key', 'not-a-boolean', 'string'),
        },
      };
      const cacheKey = hash(mockContext);
      lscache.set(cacheKey, mockEvaluationResponse.toggles, 1);

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
      const mockEvaluationResponse: EvaluationResponse = {
        toggles: {
          'flag-key': createMockEvaluation('flag-key', 'test-value', 'string'),
        },
      };

      vi.spyOn(HyphenClient.prototype, 'evaluate').mockResolvedValue(mockEvaluationResponse);
      const cacheKey = hash(mockContext);
      lscache.set(cacheKey, mockEvaluationResponse.toggles, 1);
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
      const mockEvaluationResponse: EvaluationResponse = {
        toggles: {
          'flag-key': createMockEvaluation('flag-key', 42, 'number'),
        },
      };

      vi.spyOn(HyphenClient.prototype, 'evaluate').mockResolvedValue(mockEvaluationResponse);
      const cacheKey = hash(mockContext);
      lscache.set(cacheKey, mockEvaluationResponse.toggles, 1);

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
      const mockEvaluationResponse: EvaluationResponse = {
        toggles: {
          'flag-key': createMockEvaluation('flag-key', JSON.stringify(mockObjectValue), 'object'),
        },
      };

      vi.spyOn(HyphenClient.prototype, 'evaluate').mockResolvedValue(mockEvaluationResponse);
      const cacheKey = hash(mockContext);
      lscache.set(cacheKey, mockEvaluationResponse.toggles, 1);

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

  describe('initialize', () => {
    it('should not call evaluate if targetingKey is missing', async () => {
      const evaluateSpy = vi.spyOn(HyphenClient.prototype, 'evaluate');
      const contextWithoutKey: EvaluationContext = {
        application: mockContext.application,
        environment: mockContext.environment,
      };

      await provider.initialize(contextWithoutKey);

      expect(evaluateSpy).not.toHaveBeenCalled();
    });

    it('should not cache if evaluate fails', async () => {
      const error = new Error('Evaluation failed');
      vi.spyOn(HyphenClient.prototype, 'evaluate').mockRejectedValue(error);
      const setCacheSpy = vi.spyOn(lscache, 'set');

      await expect(provider.initialize(mockContext)).rejects.toThrow(error);
      expect(setCacheSpy).not.toHaveBeenCalled();
    });
  });

  describe('onContextChange', () => {
    it('should not call evaluate if targetingKey is missing in new context', async () => {
      const evaluateSpy = vi.spyOn(HyphenClient.prototype, 'evaluate');
      // @ts-ignore
      const validateContextSpy = vi.spyOn(provider, 'validateContext').mockImplementation(() => {
        throw new Error('targetingKey is required');
      });

      const newContextWithoutKey: EvaluationContext = {
        application: mockContext.application,
        environment: mockContext.environment,
      };

      await expect(provider.onContextChange?.(mockContext, newContextWithoutKey)).rejects.toThrow(
        'targetingKey is required',
      );

      expect(validateContextSpy).toHaveBeenCalledWith(newContextWithoutKey);
      expect(evaluateSpy).not.toHaveBeenCalled();
    });
  });

  describe('Cache TTL configuration', () => {
    it('should set ttlMinutes from options.cache.ttlSeconds when provided', () => {
      const optionsWithCache = {
        ...options,
        cache: {
          ttlSeconds: 300, // 5 minutes in seconds
        },
      };

      const providerWithCache = new HyphenProvider(publicKey, optionsWithCache);
      expect(providerWithCache['ttlMinutes']).toBe(5);
    });

    it('should keep default ttlMinutes when cache.ttlSeconds is not provided', () => {
      const providerWithoutCache = new HyphenProvider(publicKey, options);
      expect(providerWithoutCache['ttlMinutes']).toBe(1); // Default value
    });
  });

  describe('isContextEqual', () => {
    it('should return false if any of the context is not provided', () => {
      const context1: EvaluationContext = {
        targetingKey: 'test-key',
        application: 'test-app',
        environment: 'test-env',
      };

      const result = provider['isContextEqual'](context1, undefined as any);

      expect(result).toBe(false);
    });
  });

  describe('getTargetingKey', () => {
    it('should return user id if targetingKey is missing and user exists', () => {
      const context: HyphenEvaluationContext = {
        targetingKey: '',
        user: { id: 'user-id' },
        application: 'test-app',
        environment: 'test-env',
      };

      const result = provider['getTargetingKey'](context);

      expect(result).toBe('user-id');
    });

    it('should return a generated string if both targetingKey and user are missing', () => {
      const context: HyphenEvaluationContext = {
        targetingKey: '',
        application: 'test-app',
        environment: 'test-env',
      };

      const result = provider['getTargetingKey'](context);

      expect(result).toMatch(/^test-app-test-env-[a-z0-9]{5,}$/);
    });
  });
});
