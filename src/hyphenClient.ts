import { EvaluationResponse, HyphenEvaluationContext, TelemetryPayload } from './types';
import { horizon, horizonEndpoints } from './config';
import { Logger } from '@openfeature/web-sdk';

export class HyphenClient {
  private readonly publicKey: string;
  private readonly horizonUrls: string[];

  constructor(publicKey: string, horizonUrls: string[] = []) {
    this.publicKey = publicKey;
    this.horizonUrls = [...horizonUrls, horizon.url];
  }

  async evaluate(context: HyphenEvaluationContext, logger?: Logger): Promise<EvaluationResponse> {
    return await this.fetchEvaluationResponse(this.horizonUrls, context, logger);
  }

  async postTelemetry(payload: TelemetryPayload, logger?: Logger) {
    await this.httpPost(horizonEndpoints.telemetry, payload, logger);
  }

  private async fetchEvaluationResponse(
    urls: string[],
    context: HyphenEvaluationContext,
    logger?: Logger,
  ): Promise<EvaluationResponse> {
    let lastError: unknown;

    for (const url of urls) {
      try {
        const response = await this.httpPost(`${url}/evaluate`, context, logger);
        return await response.json();
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  }

  private async httpPost(url: string, payload: any, logger?: Logger) {
    let lastError: unknown;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.publicKey,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return response;
      } else {
        const errorText = await response.text();
        lastError = new Error(errorText);
        logger?.debug('Failed to fetch', url, errorText);
      }
    } catch (error) {
      lastError = error;
      logger?.debug('Failed to fetch', url, error);
    }

    throw lastError;
  }
}
