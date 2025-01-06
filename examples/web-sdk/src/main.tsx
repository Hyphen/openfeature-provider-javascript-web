import { createRoot } from 'react-dom/client';
import { OpenFeature } from '@openfeature/web-sdk';
import { HyphenProvider, HyphenProviderOptions } from '@hyphen/openfeature-web-provider';
import App from './App.tsx';

const publicKey = 'your-public-key';

const options: HyphenProviderOptions = {
  application: 'your-app',
  environment: 'production',
};

OpenFeature.setProvider(new HyphenProvider(publicKey, options));

createRoot(document.getElementById('root')!).render(<App />);
