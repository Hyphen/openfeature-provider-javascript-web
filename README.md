# Hyphen Toggle OpenFeature Web Provider

The **Hyphen Toggle OpenFeature Web Provider** allows seamless feature flag evaluation using the OpenFeature standard within the Hyphen Toggle platform.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Integration](#integration)
3. [Configuration](#configuration)
4. [Contributing](#contributing)
5. [License](#license)

---

## Getting Started

### Pre-requisites
 - Ensure you have Node.js and npm installed.
 - Have access to a valid Hyphen publicKey and application details.

### Installation
To use the Hyphen Toggle OpenFeature Web Provider, install the required packages:

```bash
npm install @openfeature/react-sdk @hyphen/openfeature-web-provider
```

## Integration
To integrate the Hyphen Toggle provider into your application, follow these steps:

1. **Configure the Provider**: Register the `HyphenProvider` with OpenFeature using your `publicKey` and provider options.

  ```typescript jsx
    import { OpenFeature, OpenFeatureProvider } from '@openfeature/react-sdk';
    import { HyphenProvider, HyphenProviderOptions } from '@hyphen/openfeature-web-provider';

    const publicKey = 'your-public-key'; // Replace with your Hyphen publicKey

    // Example using an alternateId for environment
    const options: HyphenProviderOptions = {
      application: 'your-application-name',
      environment: 'production', // Using alternateId format
    };

    // OR using a project environment ID
    // const options: HyphenProviderOptions = {
    //   application: 'your-application-name',
    //   environment: 'pevr_abc123', // Using project environment ID format
    // };

    await OpenFeature.setProviderAndWait(new HyphenProvider(publicKey, options));

    function App() {
      return (
        <OpenFeatureProvider>
          <Page/>
        </OpenFeatureProvider>
      );
    }
  ```

2. **Set Up the context**: Use ``OpenFeature.setContext`` to configure the context needed for feature targeting. This context should include relevant user information, typically obtained from an authentication process.

   ```typescript jsx 
    OpenFeature.setContext({
      targetingKey: user.id,
      user: user,
      customAttributes: { role: user.role }, // Additional targeting attributes
    });

   ```
   
3. **Evaluate Feature Flags**: Use the `OpenFeature` client to evaluate feature flags in your application.

  ```typescript jsx
    import { useFlag } from '@openfeature/react-sdk';

    function Page() {
    const { value: isFeatureEnabled } = useFlag('your-flag-key', false);
      return (
        <div>
          <header>
            {isFeatureEnabled ? <p>Welcome to this Hyphen toggle-enabled React app!</p> : <p>Welcome to this React app.</p>}
          </header>
        </div>
      )
    }
  ```
   
## Configuration

### Options

| Option              | Type       | Required | Description                                                                                |
| :------------------ | :--------- | :------- | :----------------------------------------------------------------------------------------- |
| `application`       | `string`   | Yes      | The application id or alternate ID.                                                        |
| `environment`       | `string`   | Yes      | The environment identifier for the Hyphen project (project environment ID or alternateId). |
| `horizonUrls`       | `string[]` | No       | Hyphen Horizon URLs for fetching flags.                                                    |
| `enableToggleUsage` | `boolean`  | No       | Enable/disable telemetry (default: true).                                                  |

### Context

Provide an `EvaluationContext` to pass contextual data for feature evaluation.

### Context Fields

| Field                   | Type                  | Required | Description                                                        |
| ----------------------- | --------------------- | :------- | ------------------------------------------------------------------ |
| `targetingKey`          | `string`              | Yes      | The key used for caching the evaluation response.                  |
| `ipAddress`             | `string`              | No       | The IP address of the user making the request.                     |
| `customAttributes`      | `Record<string, any>` | No       | Custom attributes for additional contextual information.           |
| `user`                  | `object`              | No       | An object containing user-specific information for the evaluation. |
| `user.id`               | `string`              | No       | The unique identifier of the user.                                 |
| `user.email`            | `string`              | No       | The email address of the user.                                     |
| `user.name`             | `string`              | No       | The name of the user.                                              |
| `user.customAttributes` | `Record<string, any>` | No       | Custom attributes specific to the user.                            |

## Contributing

We welcome contributions to this project! If you'd like to contribute, please follow the guidelines outlined in [CONTRIBUTING.md](CONTRIBUTING.md). Whether it's reporting issues, suggesting new features, or submitting pull requests, your help is greatly appreciated!

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for full details.
