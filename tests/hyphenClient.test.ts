import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EvaluationResponse, HyphenEvaluationContext, TelemetryPayload } from '../src';
import { HyphenClient } from '../src/hyphenClient';
import { Logger } from '@openfeature/web-sdk';

vi.stubGlobal('fetch', vi.fn());

vi.mock('../src/config', () => ({
  horizon: {
    url: 'https://mock-horizon-url.com',
  },
  horizonEndpoints: {
    telemetry: 'https://mock-horizon-url.com/telemetry',
  },
}));

describe('HyphenClient', () => {
  const publicKey = 'test-public-key';
  const customUrl = 'https://custom-url.com';

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

  it('should successfully evaluate a flag with default horizon URL', async () => {
    const client = new HyphenClient(publicKey);

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response);

    const result = await client.evaluate(mockContext);
    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith('https://mock-horizon-url.com/evaluate', expect.any(Object));
  });

  it('should append /evaluate to the horizon URLs dynamically', async () => {
    const client = new HyphenClient(publicKey, [customUrl]);

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response);

    const result = await client.evaluate(mockContext);

    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith(`${customUrl}/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': publicKey,
      },
      body: JSON.stringify(mockContext),
    });
    expect(fetch).not.toHaveBeenCalledWith('https://mock-horizon-url.com/evaluate', expect.any(Object));
  });

  it('should try the next server URL if the first fails', async () => {
    const client = new HyphenClient(publicKey, [customUrl]);

    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('Failed'))
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      } as unknown as Response);

    const result = await client.evaluate(mockContext);

    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith(`${customUrl}/evaluate`, expect.any(Object));
    expect(fetch).toHaveBeenCalledWith('https://mock-horizon-url.com/evaluate', expect.any(Object));
  });

  it('should throw an error if all servers fail', async () => {
    const client = new HyphenClient(publicKey);

    vi.mocked(fetch).mockRejectedValue(new Error('Failed'));

    await expect(client.evaluate(mockContext)).rejects.toThrowError(new Error('Failed'));
    expect(fetch).toHaveBeenCalledWith('https://mock-horizon-url.com/evaluate', expect.any(Object));
  });

  it('should successfully send telemetry data', async () => {
    const client = new HyphenClient(publicKey);
    const payload: TelemetryPayload = {
      context: mockContext,
      data: { toggle: { key: 'test-flag', value: true, type: 'boolean', reason: 'mock-reason' } },
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: vi.fn(),
    } as unknown as Response);

    await client.postTelemetry(payload);

    expect(fetch).toHaveBeenCalledWith('https://mock-horizon-url.com/telemetry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': publicKey,
      },
      body: JSON.stringify(payload),
    });
  });

  it('should log an error and throw it when response is not OK', async () => {
    const mockLogger: Logger = {
      debug: vi.fn(),
    } as any;

    const url = 'https://mock-url.com';
    const payload = { key: 'test' };
    const errorText = 'Unauthorized';

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      text: vi.fn().mockResolvedValue(errorText),
    } as unknown as Response);

    const client = new HyphenClient(publicKey, [customUrl]);
    await expect(client['httpPost'](url, payload, mockLogger)).rejects.toThrowError(errorText);

    expect(mockLogger.debug).toHaveBeenCalledWith('Failed to fetch', url, errorText);

    expect(fetch).toHaveBeenCalledWith(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': publicKey,
      },
      body: JSON.stringify(payload),
    });
  });

  it('should append the default horizon URL to the provided custom server URLs', () => {
    const client = new HyphenClient(publicKey, [customUrl]);
    expect(client['horizonUrls']).toEqual([customUrl, 'https://mock-horizon-url.com']);
  });

  it('should successfully send telemetry data', async () => {
    const client = new HyphenClient(publicKey);
    const payload: TelemetryPayload = {
      context: mockContext,
      data: { toggle: { key: 'test-flag', value: true, type: 'boolean', reason: 'mock-reason' } },
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: vi.fn(),
    } as unknown as Response);

    await client.postTelemetry(payload);

    expect(fetch).toHaveBeenCalledWith('https://mock-horizon-url.com/telemetry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': publicKey,
      },
      body: JSON.stringify(payload),
    });
  });
});
