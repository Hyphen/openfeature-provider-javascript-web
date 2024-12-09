import { useEffect, useState } from 'react'
import { OpenFeature } from "@openfeature/web-sdk";
import { HyphenEvaluationContext, HyphenProviderOptions, HyphenProvider } from '@hyphen/openfeature-web-provider';

function App() {
  const [featureFlagValue, setFeatureFlagValue] = useState<number>(0);

  const publicKey = 'your-public-key';

  const options: HyphenProviderOptions = {
    application: 'app',
    environment: 'production',
  };

  const context: HyphenEvaluationContext = {
    targetingKey: 'target-key',
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

  useEffect(() => {
    const setupOpenFeature = async () => {
      try {
        await OpenFeature.setProviderAndWait(new HyphenProvider(publicKey, options));
        await OpenFeature.setContext(context);

        const client = OpenFeature.getClient();
        const data = client.getNumberDetails('my-number-toggle', 0);
        setFeatureFlagValue(data.value);
      } catch (error) {
        console.error('Error setting up OpenFeature:', error);
      }
    };

    setupOpenFeature();
  }, []);


  return (
    <>
      <h1>OpenFeature Example</h1>
      <p>Feature flag value: {featureFlagValue}</p>
    </>
  )
}

export default App
