import { EvaluationResponse, HyphenEvaluationContext, TelemetryPayload } from './types';
import { horizonEndpoints } from './config';

export class HyphenClient {
  private readonly publicKey: string;
  private readonly horizonServerUrls: string[];

  constructor(publicKey: string, horizonServerUrls: string[] = []) {
    this.publicKey = publicKey;
    horizonServerUrls.push(horizonEndpoints.evaluate);
    this.horizonServerUrls = horizonServerUrls;
  }

  async evaluate(context: HyphenEvaluationContext): Promise<EvaluationResponse> {
    return await this.fetchEvaluationResponse(this.horizonServerUrls, context);
  }

  async postTelemetry(payload: TelemetryPayload) {
    await this.httpPost(horizonEndpoints.telemetry, payload);
  }

  private async fetchEvaluationResponse(
    serverUrls: string[],
    context: HyphenEvaluationContext,
  ): Promise<EvaluationResponse> {
    let lastError: unknown;

    for (const url of serverUrls) {
      try {
        const response = await this.httpPost(url, context);
        return await response.json();
      } catch (error) {
        lastError = error;
        console.debug('Failed to fetch evaluation: ', url, error);
      }
    }

    throw lastError;
  }

  private async httpPost(url: string, payload: any) {
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
        console.debug('Failed to fetch', url, errorText);
      }
    } catch (error) {
      lastError = error;
    }

    throw lastError;
  }
}
