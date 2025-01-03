import {MockAuthProvider} from "./MockAuthProvider.tsx";
import Page from "./Page.tsx";

function App() {
  return (
    <MockAuthProvider>
      <Page />
    </MockAuthProvider>
  )
}

export default App;
