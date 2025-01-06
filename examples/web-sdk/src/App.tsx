import { MockAuthProvider } from './MockAuthProvider.tsx';
import Page from './Page.tsx';
import { OpenFeatureProvider } from './OpenFeatureProvider.tsx';

function App() {
  return (
    <MockAuthProvider>
      <OpenFeatureProvider>
        <Page />
      </OpenFeatureProvider>
    </MockAuthProvider>
  );
}

export default App;
