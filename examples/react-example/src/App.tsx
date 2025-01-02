import { HyphenEvaluationContext, HyphenProvider, HyphenProviderOptions } from '@hyphen/openfeature-web-provider';
import { OpenFeature } from '@openfeature/web-sdk';
import Page from './Page.tsx';

const publicKey = 'your-public-key';

const options: HyphenProviderOptions = {
  application: 'app',
  environment: 'production',
};

const context: HyphenEvaluationContext = {
  targetingKey: 'target-key',
  user: {
    id: 'user-123',
    email: 'user@example.com',
    name: 'John Doe',
    customAttributes: {
      role: 'admin',
    },
  },
};

OpenFeature.setProvider(new HyphenProvider(publicKey, options));
OpenFeature.setContext(context);

function App() {
  return <Page />;
}

export default App;
