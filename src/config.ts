export const horizon = {
  url: `https://${process.env.NODE_ENV === 'production' ? 'horizon' : 'dev-horizon'}.hyphen.ai/toggle`,
};

export const horizonEndpoints = {
  evaluate: `${horizon.url}/evaluate`,
  telemetry: `${horizon.url}/telemetry`,
};
