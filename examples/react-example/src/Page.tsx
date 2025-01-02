import { useMemo } from 'react';
import { OpenFeature } from '@openfeature/web-sdk';

const client = OpenFeature.getClient();

function Page() {
  const flagKey = 'your-flag-key';
  const fallbackValue = 'default-value';

  const value = useMemo(() => {
    return client.getStringValue(flagKey, fallbackValue);
  }, [flagKey, fallbackValue]);

  return (
    <div>
      <header>
        <p>Flag Value: {value}</p>
      </header>
    </div>
  );
}

export default Page;

// import React, { useMemo } from 'react';
// import { useStringFlagValue } from '@openfeature/react-sdk';
//
// function Page() {
//   const flagKey = 'beta';
//   const fallbackValue = 'today';
//
//   const value = useMemo(() => {
//     return useStringFlagValue(flagKey, fallbackValue);
//   }, [flagKey, fallbackValue]);
//
//   return (
//     <div className="App">
//       <header className="App-header">
//         {value ? <p>{value}</p> : <p>No value</p>}
//       </header>
//     </div>
//   );
// }
//
// export default Page;

// import {
//   useBooleanFlagDetails,
//   useBooleanFlagValue,
//   useFlag,
//   useStringFlagDetails,
//   useStringFlagValue, useSuspenseFlag
// } from "@openfeature/react-sdk";
// import {Suspense} from "react";
//
// function Page() {
//   // const { value } = useSuspenseFlag('beta', '2024');
//   // const { value } = useFlag('beta', 'not today', { updateOnContextChanged: false });
//   const value = useStringFlagValue('beta', 'today');
//   // const {
//   //   value,
//   //   variant,
//   //   reason,
//   //   flagMetadata
//   // } = useStringFlagDetails('beta', 'today');
//
//   return (
//     <div className="App">
//       <header className="App-header">
//         {value ? <p>{value}</p> : <p>No value</p>}
//       </header>
//     </div>
//   )
// };
//
// function Fallback() {
//   // component to render before READY.
//   return <p>Waiting for provider to be ready...</p>;
// }
//
// export function Content() {
//   // cause the "fallback" to be displayed if the component uses feature flags and the provider is not ready
//   return (
//     <Suspense fallback={<Fallback/>}>
//       <Page />
//     </Suspense>
//   );
// }
