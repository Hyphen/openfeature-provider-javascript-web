import { describe, it, expect } from 'vitest';
import { horizon, horizonEndpoints } from '../src/config';

describe('horizon configuration', () => {
  it('should have the correct base URL', () => {
    expect(horizon.url).toBe('https://horizon.hyphen.ai');
  });

  it('should correctly configure the evaluate endpoint', () => {
    expect(horizonEndpoints.evaluate).toBe('https://horizon.hyphen.ai/toggle/evaluate');
  });

  it('should correctly configure the telemetry endpoint', () => {
    expect(horizonEndpoints.telemetry).toBe('https://horizon.hyphen.ai/toggle/telemetry');
  });
});
