export function getOrgIdFromPublicKey(publicKey: string) {
  try {
    const keyWithoutPrefix = publicKey.replace(/^public_/, '');
    const decoded = atob(keyWithoutPrefix);
    const [orgId] = decoded.split(':');
    const isValidOrgId = /^[a-zA-Z0-9_-]+$/.test(orgId);

    return isValidOrgId ? orgId : undefined;
  } catch {
    return undefined;
  }
}

export function buildDefaultHorizonUrl(publicKey: string): string {
  const orgId = getOrgIdFromPublicKey(publicKey);
  return orgId ? `https://${orgId}.toggle.hyphen.cloud` : 'https://toggle.hyphen.cloud';
}
