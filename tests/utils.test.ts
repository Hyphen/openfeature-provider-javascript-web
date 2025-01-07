import { describe, it, expect } from 'vitest';
import { getOrgIdFromPublicKey } from '../src/utils';

describe('getOrgIdFromPublicKey', () => {
  it('should return orgId when publicKey is valid', () => {
    const validOrgId = 'org123';
    const data = `${validOrgId}:some_data`;

    const validBase64 = btoa(data);
    const validPublicKey = `public_${validBase64}`;

    const result = getOrgIdFromPublicKey(validPublicKey);

    expect(result).toBe(validOrgId);
  });

  it('should return undefined if publicKey is not a string', () => {
    expect(getOrgIdFromPublicKey(null as unknown as string)).toBeUndefined();
    expect(getOrgIdFromPublicKey(undefined as unknown as string)).toBeUndefined();
    expect(getOrgIdFromPublicKey(123 as unknown as string)).toBeUndefined();
    expect(getOrgIdFromPublicKey({} as unknown as string)).toBeUndefined();
  });
});
