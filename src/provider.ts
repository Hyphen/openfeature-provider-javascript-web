import store from 'store2';
import {
  type BeforeHookContext,
  ErrorCode,
  type EvaluationContext,
  type Hook,
  type HookContext,
  type JsonValue,
  type Logger,
  OpenFeatureEventEmitter,
  type Paradigm,
  type Provider,
  ProviderEvents,
  type ResolutionDetails,
  StandardResolutionReasons,
  TypeMismatchError,
} from '@openfeature/web-sdk';

import pkg from '../package.json';
import {
  type Evaluation,
  type EvaluationParams,
  type HyphenEvaluationContext,
  type HyphenProviderOptions,
} from './types';
import { HyphenClient } from './hyphenClient';

export class HyphenProvider implements Provider {
  public readonly options: HyphenProviderOptions;
  private readonly hyphenClient: HyphenClient;
  private readonly cacheClient = store;
  public events: OpenFeatureEventEmitter;
  public runsOn: Paradigm = 'client';
  public hooks: Hook[];
  public metadata = {
    name: 'hyphen-toggle-web',
    version: pkg.version,
  };

  constructor(publicKey: string, options: HyphenProviderOptions) {
    if (!options.application) {
      throw new Error('Application is required');
    }
    if (!options.environment) {
      throw new Error('Environment is required');
    }

    this.events = new OpenFeatureEventEmitter();
    this.hyphenClient = new HyphenClient(publicKey, options.horizonServerUrls);
    this.options = options;

    this.events.addHandler(ProviderEvents.ContextChanged, async () => {
      this.cacheClient.clearAll();
    });

    this.hooks = [
      {
        before: this.beforeHook,
        error: this.errorHook,
        finally: this.finallyHook,
      },
    ];
  }

  beforeHook = async (hookContext: BeforeHookContext): Promise<EvaluationContext> => {
    const newContext: EvaluationContext = {
      ...hookContext.context,
      application: this.options.application,
      environment: this.options.environment,
    };

    this.validateContext(newContext);

    return newContext;
  };

  errorHook = async (hookContext: HookContext, error: unknown): Promise<void> => {
    if (error instanceof Error) {
      hookContext.logger.error('Error', error.message);
    } else {
      hookContext.logger.error('Error', error);
    }
  };

  finallyHook = async (
    hookContext: HookContext,
    // hints: HookHints
  ): Promise<void> => {
    // This is a good place to log client usage. This will be post MVP
    hookContext.logger.info('logging usage');
  };

  async initialize(context?: EvaluationContext): Promise<void> {
    if (context && context.targetingKey) {
      const evaluationResponse = await this.hyphenClient.evaluate(context as HyphenEvaluationContext);
      const cacheKey = this.generateCacheKey(context as HyphenEvaluationContext);
      this.cacheClient.set(cacheKey, evaluationResponse.toggles);
    }
  }

  async onContextChange?(oldContext: EvaluationContext, newContext: EvaluationContext): Promise<void> {
    try {
      if (newContext.targetingKey) {
        const evaluationResponse = await this.hyphenClient.evaluate(newContext as HyphenEvaluationContext);

        const cacheKey = this.generateCacheKey(newContext as HyphenEvaluationContext);

        this.cacheClient.set(cacheKey, evaluationResponse.toggles);
      }
    } catch (error) {
      this.events.emit(ProviderEvents.Error, error as any);
    }
  }

  private getEvaluation<T>({
    flagKey,
    value: defaultValue,
    expectedType,
    context,
    logger,
  }: EvaluationParams<T>): ResolutionDetails<T> {
    const contextKey = this.generateCacheKey(context as HyphenEvaluationContext);
    const cache = this.cacheClient.get(contextKey) || {};

    const evaluation = cache[flagKey];
    const evaluationError = this.getEvaluationParseError({
      flagKey,
      evaluation,
      expectedType,
      value: defaultValue,
      logger,
    });
    if (evaluationError) return evaluationError;

    const value = this.validateFlagType(expectedType, evaluation.value as string);

    return {
      value: value as T,
      variant: evaluation.value.toString(),
      reason: evaluation.reason,
    };
  }

  validateFlagType<T extends string>(type: Evaluation['type'], value: T): string | number | boolean | object {
    switch (type) {
      case 'number': {
        const parsedValue = parseFloat(value);
        if (isNaN(parsedValue)) {
          throw new TypeMismatchError(`default value does not match type ${type}`);
        }
        return parsedValue;
      }
      case 'object': {
        try {
          return JSON.parse(value);
        } catch {
          throw new TypeMismatchError(`default value does not match type ${type}`);
        }
      }
      default:
        return value;
    }
  }

  wrongType<T>({ flagKey, value, evaluation, expectedType, logger }: EvaluationParams<T>): ResolutionDetails<T> {
    logger.error(`Type mismatch for flag ${flagKey}. Expected ${expectedType}, got ${evaluation!.type}.`);

    return {
      value,
      reason: StandardResolutionReasons.ERROR,
      errorCode: ErrorCode.TYPE_MISMATCH,
    };
  }

  private getEvaluationParseError<T>({
    flagKey,
    evaluation,
    expectedType,
    value: defaultValue,
    logger,
  }: EvaluationParams<T>): ResolutionDetails<T> | undefined {
    if (!evaluation) {
      logger.error(`Flag ${flagKey} not found in evaluation response.`);
      return {
        value: defaultValue,
        errorCode: ErrorCode.FLAG_NOT_FOUND,
      };
    }

    if (evaluation.errorMessage) {
      logger.error(`Error evaluating flag ${flagKey}: ${evaluation.errorMessage}`);

      return {
        value: defaultValue,
        errorMessage: evaluation?.errorMessage,
        errorCode: ErrorCode.GENERAL,
      };
    }

    if (evaluation?.type !== expectedType) {
      return this.wrongType({
        flagKey,
        value: defaultValue,
        evaluation,
        expectedType,
        logger,
      });
    }
  }

  private generateCacheKey(context: HyphenEvaluationContext): string {
    if (this.options.cache?.generateCacheKey && typeof this.options.cache.generateCacheKey === 'function') {
      return this.options.cache.generateCacheKey(context);
    }
    return `${this.options.application}-${this.options.environment}-${context.targetingKey}`;
  }

  resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
    logger: Logger,
  ): ResolutionDetails<boolean> {
    return this.getEvaluation({
      flagKey,
      value: defaultValue,
      expectedType: 'boolean',
      context,
      logger,
    });
  }

  resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
    logger: Logger,
  ): ResolutionDetails<string> {
    return this.getEvaluation({
      flagKey,
      value: defaultValue,
      expectedType: 'string',
      context,
      logger,
    });
  }

  resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
    logger: Logger,
  ): ResolutionDetails<number> {
    return this.getEvaluation({
      flagKey,
      value: defaultValue,
      expectedType: 'number',
      context,
      logger,
    });
  }

  resolveObjectEvaluation<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
    logger: Logger,
  ): ResolutionDetails<T> {
    return this.getEvaluation({
      flagKey,
      value: defaultValue,
      expectedType: 'object',
      context,
      logger,
    });
  }

  private validateContext(context: EvaluationContext): HyphenEvaluationContext {
    if (!context) {
      throw new Error('Evaluation context is required');
    }
    if (!context.targetingKey) {
      throw new Error('targetingKey is required');
    }
    if (!context.application) {
      throw new Error('application is required');
    }
    if (!context.environment) {
      throw new Error('environment is required');
    }
    return context as HyphenEvaluationContext;
  }
}
