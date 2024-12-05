# Hyphen Toggle OpenFeature Web Provider

The **Hyphen Toggle OpenFeature Web Provider** is an OpenFeature provider implementation for the Hyphen Toggle platform. It enables feature flag evaluation using the OpenFeature standard.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Usage](#usage)
3. [Configuration](#configuration)
4. [Contributing](#contributing)
5. [License](#license)

---

## Getting Started

### Installation

Install the provider and the OpenFeature web SDK:

```bash
npm install @openfeature/web-sdk @hyphen/openfeature-web-provider
```

## Usage

### Example: Basic Setup

To integrate the Hyphen Toggle provider into your application, follow these steps:

1. **Set up the provider**: Register the `HyphenProvider` with OpenFeature using your `publicKey` and provider options.
2. **Evaluate a feature toggle**: Use the client to evaluate a feature flag.

```typescript
import { OpenFeature } from '@openfeature/web-sdk';
import { HyphenProvider, type HyphenProviderOptions } from '@hyphen/openfeature-web-provider';

const publicKey = "your-public-key-here";

const options: HyphenProviderOptions = {
application: 'your-application-name',
environment: 'production',
};

await OpenFeature.setProviderAndWait(new HyphenProvider(publicKey, options));
await OpenFeature.setContext(context);

const client = OpenFeature.getClient();

const flagDetails = await client.getBooleanDetails('feature-flag-key', false);

console.log(flagDetails.value); // true or false
```

### Example: Contextual Evaluation

To evaluate a feature flag with specific user or application context, define and pass an `EvaluationContext`:

```typescript
const context: HyphenEvaluationContext = {
  targetingKey: 'user-123',
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

// Evaluate the toggle with context
const flagDetailsWithContext = await client.getBooleanDetails(toggleKey, defaultValue, context);

console.log(flagDetailsWithContext.value); // true or false
```

## Configuration

### Options

| Option          | Type   | Description                                                                           |
|------------------|--------|---------------------------------------------------------------------------------------|
| `application`    | string | The application id or alteernate id.                                                  |
| `environment`    | string | The environment in which your application is running (e.g., `production`, `staging`). |

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
