import React from 'react';
import useTimeout from './useTimeout';
import { OpenFeature } from '@openfeature/web-sdk';

interface IAuthContext {
  isLoading: boolean;
  user: Record<string, any> | undefined;
  customAttributes?: Record<string, string>;
}

const AuthContext = React.createContext<IAuthContext>({
  isLoading: true,
  user: undefined,
  customAttributes: {},
});

export const MockAuthProvider = ({ children }) => {
  const [value, setValue] = React.useState<IAuthContext>({
    isLoading: true,
    user: undefined,
    customAttributes: {},
  });

  useTimeout(() => {
    const user = {
      id: 'user-123',
      name: 'John Doe',
      email: 'user@example.com',
      customAttributes: {
        role: 'admin',
      },
    };

    setValue({
      isLoading: false,
      user: user,
    });

    OpenFeature.setContext({
      targetingKey: user.id,
      customAttributes: {},
      user: user,
    });
  }, 1000);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return React.useContext(AuthContext);
};
