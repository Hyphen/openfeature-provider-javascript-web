import type { EvaluationContext, Logger } from '@openfeature/web-sdk';

export type HyphenProviderOptions = {
  /** The application name or ID for the current evaluation. */
  application: string;
  /** The environment for the Hyphen project (e.g., `production`, `staging`). */
  environment: string;
  /** The Hyphen server URL */
  horizonServerUrls?: string[];
};

export interface HyphenEvaluationContext extends EvaluationContext {
  /** The key used for caching the evaluation response. */
  targetingKey: string;
  /** The IP address of the user making the request. */
  ipAddress: string;
  /** The application name or ID for the current evaluation. */
  application: string;
  /** The environment for the Hyphen project (e.g., `production`, `staging`). */
  environment: string;
  /** Custom attributes for additional contextual information. */
  customAttributes: Record<string, any>;
  /** An object containing user-specific information for the evaluation. */
  user: {
    /** The unique identifier of the user. */
    id: string;
    /** The email address of the user. */
    email: string;
    /** The name of the user. */
    name: string;
    /** Custom attributes specific to the user. */
    customAttributes: Record<string, any>;
  };
}

export interface Evaluation {
  key: string;
  value: boolean | string | number | Record<string, any>;
  type: 'boolean' | 'string' | 'number' | 'object';
  reason: string;
  errorMessage: string;
}

export interface EvaluationResponse {
  toggles: Record<string, Evaluation>;
}

export type EvaluationParams<T> = {
  flagKey: string;
  value: T;
  expectedType: Evaluation['type'];
  evaluation?: Evaluation;
  logger: Logger;
};
