export const REGION_URLS: Record<string, string> = {
  US: 'https://usiot.roborock.com',
  EU: 'https://euiot.roborock.com',
  CN: 'https://cniot.roborock.com',
  RU: 'https://ruiot.roborock.com',
};

export function getBaseUrl(region?: string): string {
  const r = region?.toUpperCase() ?? 'US';
  return REGION_URLS[r] ?? REGION_URLS['US'];
}
