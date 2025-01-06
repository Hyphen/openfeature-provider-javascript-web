import React from 'react';
import { Client, FlagEvaluationOptions, OpenFeature } from '@openfeature/web-sdk';

interface IOpenFeatureProvider {
  client: Client;
  domain?: string;
  options: FlagEvaluationOptions;
}

type ClientOrDomain =
  | {
      domain?: string;
      client?: never;
    }
  | {
      client?: Client;
      domain?: never;
    };

type ProviderProps = {
  children?: React.ReactNode;
} & ClientOrDomain &
  FlagEvaluationOptions;

const ProviderContext = React.createContext<IOpenFeatureProvider>(undefined);

export function OpenFeatureProvider({ client, domain, children, ...options }: ProviderProps) {
  if (!client) {
    client = OpenFeature.getClient(domain);
  }

  return <ProviderContext.Provider value={{ client, options, domain }}>{children}</ProviderContext.Provider>;
}

export function useOpenFeature() {
  return React.useContext(ProviderContext);
}
