import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EvaluationResponse, HyphenEvaluationContext } from '../src';
import { HyphenClient } from '../src/hyphenClient';

vi.stubGlobal('fetch', vi.fn());

vi.mock('../src/config', () => ({
  horizonEndpoints: {
    evaluate: 'https://mock-horizon-url.com',
    telemetry: 'https://mock-telemetry-url.com',
  },
}));

describe('HyphenClient', () => {
  const publicKey = 'test-public-key';
  const horizonUrl = 'https://mock-horizon-url.com';
  const serverUrls = [horizonUrl];

  const mockContext: HyphenEvaluationContext = {
    targetingKey: 'test-key',
    ipAddress: '127.0.0.1',
    application: 'test-app',
    environment: 'test-env',
    customAttributes: { role: 'admin' },
    user: {
      id: 'user-id',
      email: 'user@example.com',
      name: 'Test User',
      customAttributes: { subscription: 'premium' },
    },
  };

  const mockResponse: EvaluationResponse = {
    toggles: {
      'test-flag': {
        key: 'test-flag',
        type: 'boolean',
        value: true,
        reason: 'mock-reason',
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully evaluate a flag', async () => {
    const client = new HyphenClient(publicKey, [...serverUrls]);

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response);

    const result = await client.evaluate(mockContext);
    expect(result).toEqual(mockResponse);
  });

  it('should try the next server URL if the first fails', async () => {
    const client = new HyphenClient(publicKey, [...serverUrls, 'https://alternate-url.com']);

    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('Failed'))
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      } as unknown as Response);

    const result = await client.evaluate(mockContext);
    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith('https://mock-horizon-url.com', expect.any(Object));
    expect(fetch).toHaveBeenCalledWith('https://alternate-url.com', expect.any(Object));
  });

  it('should throw an error if all servers fail', async () => {
    const client = new HyphenClient(publicKey);

    vi.mocked(fetch).mockRejectedValue(new Error('Failed'));

    await expect(client.evaluate(mockContext)).rejects.toThrowError(new Error('Failed'));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should handle non-OK responses gracefully', async () => {
    const client = new HyphenClient(publicKey, serverUrls);
    const errorText = 'Error: Unauthorized';

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      text: vi.fn().mockResolvedValue(errorText),
    } as unknown as Response);

    await expect(client.evaluate(mockContext)).rejects.toThrowError(errorText);

    expect(fetch).toHaveBeenCalledWith(serverUrls[0], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': publicKey,
      },
      body: JSON.stringify(mockContext),
    });
  });

  it('should append the default horizon URL to the provided custom server URLs', async () => {
    const customUrl = 'https://custom-url.com';
    const client = new HyphenClient(publicKey, [customUrl]);

    expect(client['horizonServerUrls']).toEqual([customUrl, 'https://mock-horizon-url.com']);
  });

  it('should successfully send telemetry data', async () => {
    const client = new HyphenClient(publicKey);

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: vi.fn(),
    } as unknown as Response);

    await client.postTelemetry(mockContext as any); // No need to capture a result

    expect(fetch).toHaveBeenCalledWith('https://mock-telemetry-url.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': publicKey,
      },
      body: JSON.stringify(mockContext),
    });
  });
});
