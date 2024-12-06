import type { EvaluationResponse, HyphenEvaluationContext } from './types';
import { horizon } from './config';

export class HyphenClient {
  private readonly publicKey: string;
  private readonly horizonServerUrls: string[];

  constructor(publicKey: string, horizonServerUrls: string[] = []) {
    this.publicKey = publicKey;
    horizonServerUrls.push(horizon.url);
    this.horizonServerUrls = horizonServerUrls;
  }

  async evaluate(context: HyphenEvaluationContext): Promise<EvaluationResponse> {
    return await this.fetchEvaluationResponse(this.horizonServerUrls, context);
  }

  private async fetchEvaluationResponse(
    serverUrls: string[],
    context: HyphenEvaluationContext,
  ): Promise<EvaluationResponse> {
    let lastError: unknown;
    let evaluationResponse;

    for (const url of serverUrls) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.publicKey,
          },
          body: JSON.stringify(context),
        });

        if (response.ok) {
          evaluationResponse = <EvaluationResponse>await response.json();
        } else {
          const errorText = await response.text();
          lastError = new Error(errorText);
          console.debug('Failed to fetch evaluation: ', url, errorText);
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (evaluationResponse) {
      return evaluationResponse;
    }

    throw lastError;
  }
}
