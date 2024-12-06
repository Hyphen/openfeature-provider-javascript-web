import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EvaluationResponse, HyphenEvaluationContext } from '../src';
import { HyphenClient } from '../src/hyphenClient';
import { horizon } from '../src/config';

vi.stubGlobal('fetch', vi.fn());

describe('HyphenClient', () => {
  const publicKey = 'test-public-key';
  const serverUrls = ['https://mock-horizon-url.com'];
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
        errorMessage: '',
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    horizon.url = serverUrls[0];
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
    const client = new HyphenClient(publicKey);

    const errorText = 'Error: Unauthorized';
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      text: vi.fn().mockResolvedValue(errorText),
    } as unknown as Response);

    await expect(client.evaluate(mockContext)).rejects.toThrowError(errorText);
    expect(fetch).toHaveBeenCalledWith('https://mock-horizon-url.com', expect.any(Object));
  });

  it('should use the default horizon URL if none provided', async () => {
    const customUrl = 'https://custom-url.com';
    const client = new HyphenClient(publicKey, [customUrl]);

    expect(client['horizonServerUrls']).toEqual([customUrl, 'https://mock-horizon-url.com']);
  });
});
