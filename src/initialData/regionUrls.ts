export const REGION_URLS: Record<string, string> = {
  US: 'https://usiot.roborock.com',
  EU: 'https://euiot.roborock.com',
  CN: 'https://cniot.roborock.com',
  RU: 'https://ruiot.roborock.com',
};

/**
 * Get the base API URL for a specific region.
 * @param region - Region code (US, EU, CN, RU). Case-insensitive.
 * @returns Base URL for the specified region, defaults to US if region not found
 */
export function getBaseUrl(region?: string): string {
  const r = region?.toUpperCase() ?? 'US';
  return REGION_URLS[r] ?? REGION_URLS.US;
}
