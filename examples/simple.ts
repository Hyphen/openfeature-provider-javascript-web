import { OpenFeature } from '@openfeature/web-sdk';
import { type HyphenEvaluationContext, HyphenProvider, type HyphenProviderOptions } from '../src';

const publicKey = 'your-public-key';

const options: HyphenProviderOptions = {
  application: 'app',
  environment: 'production',
};

const context: HyphenEvaluationContext = {
  targetingKey: 'target-key-1',
  ipAddress: '203.0.113.42',
  customAttributes: {
    subscriptionLevel: 'premium',
    region: 'us-east',
  },
  user: {
    id: 'user-123',
    email: 'user@example.com',
    name: 'John Doe',
    customAttributes: {
      role: 'admin',
    },
  },
};

// Register your feature flag provider
await OpenFeature.setProviderAndWait(new HyphenProvider(publicKey, options));

await OpenFeature.setContext(context);

// create a new client
const client = OpenFeature.getClient();

// Evaluate your feature flag
// @ts-ignore
const data = client.getNumberDetails('my-number-toggle', 0);

console.log('Data', data.value);
