import { EvaluationResponse, HyphenEvaluationContext, TelemetryPayload } from './types';
import { horizon } from './config';
import { Logger } from '@openfeature/web-sdk';

export class HyphenClient {
  private readonly publicKey: string;
  private readonly horizonUrls: string[];

  constructor(publicKey: string, horizonUrls: string[] = []) {
    this.publicKey = publicKey;
    this.horizonUrls = [...(horizonUrls || []), horizon.url];
  }

  async evaluate(context: HyphenEvaluationContext, logger?: Logger): Promise<EvaluationResponse> {
    const response = await this.tryUrlsRequest('/toggle/evaluate', context, logger);
    return await response.json();
  }

  async postTelemetry(payload: TelemetryPayload, logger?: Logger) {
    await this.tryUrlsRequest('/toggle/telemetry', payload, logger);
  }

  private async tryUrlsRequest<T>(path: string, payload: T, logger?: Logger): Promise<Response> {
    let lastError: unknown;

    for (let url of this.horizonUrls) {
      try {
        const baseUrl = new URL(url);
        const basePath = baseUrl.pathname.replace(/\/$/, '');
        path = path.replace(/^\//, '');
        baseUrl.pathname = basePath ? `${basePath}/${path}` : path;
        url = baseUrl.toString();

        return await this.httpPost(url, payload, logger);
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
