import type { EvaluationContext, FlagValue, Logger, ResolutionReason } from '@openfeature/web-sdk';

export type HyphenProviderOptions = {
  /** The application name or ID for the current evaluation. */
  application: string;
  /** The environment for the Hyphen project (e.g., `production`, `staging`). */
  environment: string;
  /** The Hyphen server URL */
  horizonUrls?: string[];
  /** Flag to enable toggle usage */
  enableToggleUsage?: boolean;
};

type WithUndefined<T> = {
  [P in keyof T]: T[P] extends object ? WithUndefined<T[P]> | undefined : T[P] | undefined;
};

type OptionalContextProperties = WithUndefined<EvaluationContext>;

export interface HyphenEvaluationContext extends OptionalContextProperties {
  /** The key used for caching the evaluation response. */
  targetingKey: string;
  /** The IP address of the user making the request. */
  ipAddress?: string;
  /** Custom attributes for additional contextual information. */
  customAttributes?: Record<string, any>;
  /** An object containing user-specific information for the evaluation. */
  user?: {
    /** The unique identifier of the user. */
    id: string;
    /** The email address of the user. */
    email?: string;
    /** The name of the user. */
    name?: string;
    /** Custom attributes specific to the user. */
    customAttributes?: Record<string, any>;
  };
}

export interface Evaluation {
  key: string;
  value: FlagValue;
  type: 'boolean' | 'string' | 'number' | 'object';
  reason?: ResolutionReason;
  errorMessage?: string;
}

export interface EvaluationResponse {
  toggles: Record<string, Evaluation>;
}

export interface TelemetryPayload {
  context: HyphenEvaluationContext;
  data: {
    toggle: Evaluation;
  };
}

export type EvaluationParams<T> = {
  flagKey: string;
  defaultValue: T;
  expectedType: Evaluation['type'];
  evaluation?: Evaluation;
  context?: EvaluationContext;
  logger: Logger;
};
