import { describe, it, expect, vi, beforeEach } from 'vitest';
import hash from 'object-hash';
import { HyphenClient } from '../src/hyphenClient';
import {
  type BeforeHookContext,
  ErrorCode,
  EvaluationContext,
  type HookContext,
  Logger,
  TypeMismatchError,
} from '@openfeature/web-sdk';
import { type EvaluationParams, type HyphenEvaluationContext, HyphenProvider, TelemetryPayload } from '../src';
import type { Evaluation, EvaluationResponse } from '../src';
import lscache from 'lscache';

vi.mock('../src/hyphenClient');
vi.mock('../src/config', () => ({
  horizon: { url: 'https://mock-horizon-url.com' },
  horizonEndpoints: {
    telemetry: 'https://mock-horizon-url.com/telemetry',
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
    horizonUrls: ['https://test-server.com'],
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
        context: mockContext,
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
      expect(result.targetingKey).toBe(mockContext.targetingKey);
    });

    it('should generate a targetingKey if it is missing', async () => {
      const mockContextWithoutKey: BeforeHookContext = {
        context: {
          application: 'test-app',
          environment: 'test-env',
        },
        flagKey: 'test-flag',
        defaultValue: true,
        flagValueType: 'boolean',
        logger: mockLogger,
        clientMetadata: { providerMetadata: { name: 'hyphen' } },
        providerMetadata: { name: 'hyphen' },
      };

      const result = await provider.beforeHook(mockContextWithoutKey);

      expect(result.targetingKey).toMatch(/^test-app-test-env-[a-z0-9]{5,}$/);
    });

    it('should log errors in errorHook', async () => {
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
      const mockPostTelemetry = vi.spyOn(HyphenClient.prototype, 'postTelemetry').mockResolvedValue(undefined);

      const hookContext: HookContext = {
        logger: mockLogger,
        flagValueType: 'boolean',
        context: { application: 'test-app', environment: 'test-env' },
      } as any;

      const evaluationDetails: any = {
        flagKey: 'test-flag',
        value: true,
        reason: 'mock-reason',
      };

      const expectedPayload: TelemetryPayload = {
        context: hookContext.context as HyphenEvaluationContext,
        data: {
          toggle: {
            key: evaluationDetails.flagKey,
            value: evaluationDetails.value,
            type: hookContext.flagValueType,
            reason: evaluationDetails.reason,
          },
        },
      };

      provider = new HyphenProvider(publicKey, options);

      await provider.afterHook(hookContext, evaluationDetails);

      expect(mockPostTelemetry).toHaveBeenCalledWith(expectedPayload, hookContext.logger);
      expect(mockPostTelemetry).toHaveBeenCalledTimes(1);
    });

    it('should log an error and rethrow it if postTelemetry fails', async () => {
      const postTelemetryError = new Error('Failed to send telemetry');

      vi.spyOn(provider['hyphenClient'], 'postTelemetry').mockRejectedValue(postTelemetryError);

      const mockLogger: Logger = {
        debug: vi.fn(),
      } as any;

      const hookContext: HookContext = {
        logger: mockLogger,
        flagValueType: 'boolean',
        context: {},
      } as any;

      const evaluationDetails = {
        flagKey: 'test-flag',
        value: true,
        reason: 'mock-reason',
      } as any;

      await expect(provider.afterHook(hookContext, evaluationDetails)).rejects.toThrow(postTelemetryError);

      expect(mockLogger.debug).toHaveBeenCalledWith('Unable to log usage.', postTelemetryError);
    });
  });

  describe('generateCacheKey', () => {
    it('should use a custom cache key generator if provided', () => {
      const customKeyFn = vi.fn(() => 'custom-key');
      const customProvider = new HyphenProvider(publicKey, { ...options, cache: { generateCacheKey: customKeyFn } });

      // @ts-ignore
      const cacheKey = customProvider['generateCacheKey'](mockContext);
      expect(customKeyFn).toHaveBeenCalledWith(mockContext);
      expect(cacheKey).toEqual('custom-key');
    });
  });

  describe('Cache Management', () => {
    it('should retrieve cached evaluations using hashed key', () => {
      const mockResponse = { toggles: { 'test-flag': createMockEvaluation('test-flag', true, 'boolean') } };
      const cacheKey = hash(mockContext);

      lscache.set(cacheKey, mockResponse.toggles, 1);

      const result = provider['getEvaluation']({
        flagKey: 'test-flag',
        context: mockContext,
        defaultValue: false,
        expectedType: 'boolean',
        logger: mockLogger,
      });

      expect(result).toEqual({
        value: true,
        variant: 'true',
        reason: 'EVALUATED',
      });
    });
  });

  describe('fetchAndCacheEvaluation', () => {
    it('should fetch evaluation and cache the toggles', async () => {
      const mockCacheClient = lscache;
      const mockTTLMinutes = 5;

      const mockContext: HyphenEvaluationContext = {
        targetingKey: 'test-key',
        application: 'test-app',
        environment: 'test-env',
      };

      const mockResponse: EvaluationResponse = {
        toggles: {
          'test-flag': {
            key: 'test-flag',
            value: true,
            type: 'boolean',
            reason: 'EVALUATED',
          },
        },
      };

      const providerWithCustomTTL = new HyphenProvider(publicKey, {
        horizonUrls: ['https://mock-url.com'],
        application: 'test-app',
        environment: 'test-env',
        cache: { ttlSeconds: mockTTLMinutes * 60 },
      });

      const evaluateSpy = vi
        .spyOn(providerWithCustomTTL['hyphenClient'], 'evaluate')
        .mockResolvedValue(mockResponse);

      const expectedCacheKey = hash(mockContext);

      await providerWithCustomTTL['fetchAndCacheEvaluation'](mockContext);

      expect(evaluateSpy).toHaveBeenCalledWith(mockContext);

      expect(mockCacheClient.set).toHaveBeenCalledWith(expectedCacheKey, mockResponse.toggles, mockTTLMinutes);
    });
  });

  describe('validateFlagType', () => {
    it('should throw a TypeMismatchError when the value cannot be parsed as a number', () => {
      const invalidValue = 'not-a-number';
      const type = 'number';

      expect(() => {
        provider['validateFlagType'](type, invalidValue);
      }).toThrowError(new TypeMismatchError(`Value does not match type ${type}`));
    });

    it('should throw a TypeMismatchError when the value cannot be parsed as an object', () => {
      const invalidValue = 'not-json';
      const type = 'object';

      expect(() => {
        provider['validateFlagType'](type, invalidValue);
      }).toThrowError(new TypeMismatchError(`Value does not match type ${type}`));
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
        defaultValue: 'default',
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
        defaultValue: 'default',
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
        defaultValue: false,
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
        defaultValue: false,
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
    it('should validate and fetch evaluation when context with targetingKey is provided', async () => {
      const mockContext: EvaluationContext = {
        targetingKey: 'test-key',
      };

      const validatedContext: any = {
        ...mockContext,
        application: options.application,
        environment: options.environment,
      };

      const validateContextSpy = vi.spyOn(provider as any, 'validateContext').mockReturnValue(validatedContext);
      const fetchAndCacheSpy = vi.spyOn(provider as any, 'fetchAndCacheEvaluation').mockResolvedValue(undefined);

      await provider.initialize(mockContext);

      expect(validateContextSpy).toHaveBeenCalledWith(validatedContext);

      expect(fetchAndCacheSpy).toHaveBeenCalledWith(validatedContext);
    });

    it('should do nothing if context is not provided', async () => {
      const validateContextSpy = vi.spyOn(provider as any, 'validateContext');
      const fetchAndCacheSpy = vi.spyOn(provider as any, 'fetchAndCacheEvaluation');

      await provider.initialize(undefined);

      expect(validateContextSpy).not.toHaveBeenCalled();
      expect(fetchAndCacheSpy).not.toHaveBeenCalled();
    });

    it('should do nothing if context does not have a targetingKey', async () => {
      const invalidContext: EvaluationContext = {
        application: 'test-app',
        environment: 'test-env',
      };

      const validateContextSpy = vi.spyOn(provider as any, 'validateContext');
      const fetchAndCacheSpy = vi.spyOn(provider as any, 'fetchAndCacheEvaluation');

      await provider.initialize(invalidContext);

      expect(validateContextSpy).not.toHaveBeenCalled();
      expect(fetchAndCacheSpy).not.toHaveBeenCalled();
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

    it('should validate and fetch evaluation if context has changed', async () => {
      const oldContext: EvaluationContext = { targetingKey: 'old-key' };
      const newContext: EvaluationContext = { targetingKey: 'new-key' };

      const validatedContext: EvaluationContext = {
        ...newContext,
        application: options.application,
        environment: options.environment,
      };

      const isContextEqualSpy = vi.spyOn(provider as any, 'isContextEqual').mockReturnValue(false);

      const validateContextSpy = vi.spyOn(provider as any, 'validateContext').mockReturnValue(validatedContext);
      const fetchAndCacheSpy = vi.spyOn(provider as any, 'fetchAndCacheEvaluation').mockResolvedValue(undefined);

      await provider.onContextChange?.(oldContext, newContext);

      expect(isContextEqualSpy).toHaveBeenCalledWith(oldContext, newContext);

      expect(validateContextSpy).toHaveBeenCalledWith(validatedContext);

      expect(fetchAndCacheSpy).toHaveBeenCalledWith(validatedContext);
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

  it('should return targetingKey if it exists', () => {
    const context: HyphenEvaluationContext = {
      targetingKey: 'test-targeting-key',
      application: 'test-app',
      environment: 'test-env',
    };

    const result = provider['getTargetingKey'](context);

    expect(result).toBe('test-targeting-key');
  });
});
