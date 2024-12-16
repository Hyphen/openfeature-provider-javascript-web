import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('horizon configuration', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.resetModules();
  });

  it('should use production URL when NODE_ENV is production', async () => {
    process.env.NODE_ENV = 'production';
    const { horizon } = await import('../src/config');

    expect(horizon.url).toBe('https://horizon.hyphen.ai/toggle/evaluate');
  });

  it('should use development URL when NODE_ENV is not production', async () => {
    process.env.NODE_ENV = 'development';
    const { horizon } = await import('../src/config');

    expect(horizon.url).toBe('https://dev-horizon.hyphen.ai/toggle/evaluate');
  });

  it('should use development URL when NODE_ENV is undefined', async () => {
    // Type-safe way to set NODE_ENV to undefined
    process.env.NODE_ENV = undefined as unknown as string;
    const { horizon } = await import('../src/config');

    expect(horizon.url).toBe('https://dev-horizon.hyphen.ai/toggle/evaluate');
  });
});
