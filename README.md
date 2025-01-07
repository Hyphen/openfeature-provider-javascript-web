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
npm install @openfeature/web-sdk @hyphen/openfeature-web-provider
```

## Integration
To integrate the Hyphen Toggle provider into your application, follow these steps:

1. **Configure the Provider**: Register the `HyphenProvider` with OpenFeature using your `publicKey` and provider options.

    Add the following setup to your application:
   ```typescript jsx
   import { OpenFeature, ProviderEvents } from '@openfeature/web-sdk';
   import { HyphenProvider, HyphenProviderOptions } from '@hyphen/openfeature-web-provider';
   
   const publicKey = 'your-public-key'; // Replace with your Hyphen publicKey
   
   const options: HyphenProviderOptions = {
     application: 'your-app-name', // Replace with your application name
     environment: 'production',    // Replace with the appropriate environment
   };
   
   OpenFeature.setProvider(new HyphenProvider(publicKey, options));
   
   createRoot(document.getElementById('root')!).render(<App />);
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
    const client = OpenFeature.getClient();
    const isEnabled = client.getStringDetails('your-flag-key', 'default value');
    ```
   
## Configuration

### Options

| Option          | Type   | Description                                                                        |
|------------------|--------|------------------------------------------------------------------------------------|
| `application`    | string | The application id or alternate id.                                                |
| `environment`    | string | The environment in which your application is running (e.g., `production`, `staging`). |
| `horizonUrls`    | string[] | An array of Hyphen Horizon URLs to use for fetching feature flags.                |
| `enableToggleUsage` | boolean | Enable or disable the logging of toggle usage (telemetry).                         |

### Context

Provide an `EvaluationContext` to pass contextual data for feature evaluation.

### Context Fields

| Field               | Type                 | Description                                                                 |
|---------------------|----------------------|-----------------------------------------------------------------------------|
| `targetingKey`      | `string`            | The key used for caching the evaluation response.                          |
| `ipAddress`         | `string`            | The IP address of the user making the request.                             |
| `customAttributes`  | `Record<string, any>` | Custom attributes for additional contextual information.                   |
| `user`              | `object`            | An object containing user-specific information for the evaluation.         |
| `user.id`           | `string`            | The unique identifier of the user.                                         |
| `user.email`        | `string`            | The email address of the user.                                             |
| `user.name`         | `string`            | The name of the user.                                                      |
| `user.customAttributes` | `Record<string, any>` | Custom attributes specific to the user.                                    |

## Contributing

We welcome contributions to this project! If you'd like to contribute, please follow the guidelines outlined in [CONTRIBUTING.md](CONTRIBUTING.md). Whether it's reporting issues, suggesting new features, or submitting pull requests, your help is greatly appreciated!

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for full details.
