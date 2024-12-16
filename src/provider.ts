import lscache from 'lscache';
import hash from 'object-hash';
import {
  type BeforeHookContext,
  ErrorCode,
  type EvaluationContext,
  EvaluationDetails,
  FlagValue,
  type Hook,
  type HookContext,
  type JsonValue,
  type Logger,
  OpenFeatureEventEmitter,
  type Paradigm,
  type Provider,
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
  TelemetryPayload,
} from './types';
import { HyphenClient } from './hyphenClient';

export class HyphenProvider implements Provider {
  public readonly options: HyphenProviderOptions;
  private readonly hyphenClient: HyphenClient;
  private readonly cacheClient = lscache;
  private ttlMinutes = 1;

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

    this.hyphenClient = new HyphenClient(publicKey, options.horizonServerUrls);
    this.options = options;
    this.events = new OpenFeatureEventEmitter();
    this.ttlMinutes = options.cache?.ttlSeconds ? options.cache.ttlSeconds / 60 : this.ttlMinutes;

    this.hooks = [
      {
        before: this.beforeHook,
        error: this.errorHook,
        after: this.afterHook,
      },
    ];
  }

  beforeHook = async ({ context }: BeforeHookContext): Promise<EvaluationContext> => {
    const { application, environment } = this.options;

    return {
      ...context,
      application,
      environment,
      targetingKey: this.getTargetingKey(context as HyphenEvaluationContext),
    };
  };

  errorHook = async (hookContext: HookContext, error: unknown): Promise<void> => {
    if (error instanceof Error) {
      hookContext.logger.debug('Error', error.message);
    } else {
      hookContext.logger.debug('Error', error);
    }
  };

  afterHook = async (hookContext: HookContext, evaluationDetails: EvaluationDetails<FlagValue>): Promise<void> => {
    const parsedEvaluationDetails = {
      key: evaluationDetails.flagKey,
      value: evaluationDetails.value,
      type: hookContext.flagValueType,
      reason: evaluationDetails.reason,
    };

    try {
      const payload: TelemetryPayload = {
        context: hookContext.context as HyphenEvaluationContext,
        data: { toggle: parsedEvaluationDetails },
      };

      await this.hyphenClient.postTelemetry(payload, hookContext.logger);
      hookContext.logger.debug('Payload sent to postTelemetry:', JSON.stringify(payload));
    } catch (error) {
      hookContext.logger.debug('Error in afterHook:', error);
      throw error;
    }
  };

  private getTargetingKey(hyphenEvaluationContext: HyphenEvaluationContext): string {
    if (hyphenEvaluationContext.targetingKey) {
      return hyphenEvaluationContext.targetingKey;
    }
    if (hyphenEvaluationContext.user) {
      return hyphenEvaluationContext.user.id;
    }
    // TODO: what is a better way to do this? Should we also have a service property so we don't add the random value?
    return `${this.options.application}-${this.options.environment}-${Math.random().toString(36).substring(7)}`;
  }

  async initialize(context?: EvaluationContext): Promise<void> {
    if (context && context.targetingKey) {
      const validatedContext = this.validateContext(context);

      if (validatedContext) {
        const evaluationResponse = await this.hyphenClient.evaluate(validatedContext);
        const cacheKey = this.generateCacheKey(validatedContext);

        this.cacheClient.set(cacheKey, evaluationResponse.toggles, this.ttlMinutes);
      }
    }
  }

  async onContextChange?(oldContext: EvaluationContext, newContext: EvaluationContext): Promise<void> {
    const hasContextChanged = !this.isContextEqual(oldContext, newContext);

    const validatedNewContext = this.validateContext(newContext);
    if (hasContextChanged) {
      const evaluationResponse = await this.hyphenClient.evaluate(validatedNewContext);
      const cacheKey = this.generateCacheKey(validatedNewContext);

      const toggles = evaluationResponse.toggles;
      this.cacheClient.set(cacheKey, toggles, this.ttlMinutes);
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

    const evaluation = cache?.[flagKey];
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

  private isContextEqual(context1: EvaluationContext, context2: EvaluationContext): boolean {
    if (!context1 || !context2) {
      return false;
    }

    return context1.targetingKey === context2.targetingKey && JSON.stringify(context1) === JSON.stringify(context2);
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

  private wrongType<T>({
    flagKey,
    value,
    evaluation,
    expectedType,
    logger,
  }: EvaluationParams<T>): ResolutionDetails<T> {
    logger.debug(`Type mismatch for flag ${flagKey}. Expected ${expectedType}, got ${evaluation!.type}.`);

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
      logger.debug(`Flag ${flagKey} not found in evaluation response.`);
      return {
        value: defaultValue,
        errorCode: ErrorCode.FLAG_NOT_FOUND,
      };
    }

    if (evaluation.errorMessage) {
      logger.debug(`Error evaluating flag ${flagKey}: ${evaluation.errorMessage}`);

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
    return hash(context);
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
