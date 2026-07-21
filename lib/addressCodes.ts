import countriesRaw from '@/data/countries.json';
import subdivisionsRaw from '@/data/subdivisions.json';

export type CountryOption = {
  code: string;
  name: string;
};

export type RegionOption = {
  code: string;
  name: string;
};

type RawCountry = {
  ['alpha-2']?: string;
  name?: string;
};

type RawSubdivisionCountry = {
  name?: string;
  divisions?: Record<string, string | { name?: string; localName?: string }>;
};

type RawSubdivisions = Record<string, RawSubdivisionCountry>;

// Handle both direct array and default-wrapped JSON
const typedCountries: RawCountry[] = (
  ((countriesRaw as any).default || countriesRaw) as RawCountry[]
);

const typedSubdivisions: RawSubdivisions = (
  (subdivisionsRaw as any).default || subdivisionsRaw
) as RawSubdivisions;

export const COUNTRIES: readonly CountryOption[] = typedCountries
  .map((country) => ({
    code: String(country['alpha-2'] || '').trim().toUpperCase(),
    name: String(country.name || '').trim(),
  }))
  .filter((country) => country.code && country.name)
  .sort((a, b) => a.name.localeCompare(b.name));

export const COUNTRY_CODE_SET = new Set(COUNTRIES.map((country) => country.code));

export const REGIONS_BY_COUNTRY: Readonly<Record<string, readonly RegionOption[]>> = Object.fromEntries(
  Object.entries(typedSubdivisions).map(([countryCode, entry]) => {
    const regions = Object.entries(entry?.divisions || {})
      .map(([fullCode, value]) => {
        const name = typeof value === 'string'
          ? value
          : value?.name || value?.localName || fullCode;

        const normalizedCountry = String(countryCode || '').trim().toUpperCase();
        const normalizedFullCode = String(fullCode || '').trim().toUpperCase();
        const prefix = `${normalizedCountry}-`;
        const shortCode = normalizedFullCode.startsWith(prefix)
          ? normalizedFullCode.slice(prefix.length)
          : normalizedFullCode;

        return {
          code: shortCode,
          name: String(name || '').trim(),
        };
      })
      .filter((region) => region.code && region.name)
      .sort((a, b) => a.name.localeCompare(b.name));

    return [String(countryCode).trim().toUpperCase(), regions] as const;
  })
) as Readonly<Record<string, readonly RegionOption[]>>;

export function normalizeCountryCode(value?: string | null): string | undefined {
  if (!value) return undefined;
  const code = String(value).trim().toUpperCase();
  return COUNTRY_CODE_SET.has(code) ? code : undefined;
}

export function normalizeRegionCode(value?: string | null): string | undefined {
  if (!value) return undefined;
  const code = String(value).trim().toUpperCase();
  return code || undefined;
}

export function getRegionsForCountry(countryCode?: string | null): readonly RegionOption[] {
  const country = normalizeCountryCode(countryCode);
  if (!country) return [];
  return REGIONS_BY_COUNTRY[country] ?? [];
}

export function countryRequiresRegion(countryCode?: string | null): boolean {
  return getRegionsForCountry(countryCode).length > 0;
}

export function validateShippingCodes(shippingInfo: {
  country_code?: string | null;
  state_code?: string | null;
}) {
  const country = normalizeCountryCode(shippingInfo?.country_code);

  if (!country) {
    throw new Error(`Invalid country_code: ${shippingInfo?.country_code ?? ''}`);
  }

  const regions = getRegionsForCountry(country);
  const state = normalizeRegionCode(shippingInfo?.state_code);

  if (regions.length > 0) {
    const validRegion = regions.some((region) => region.code === state);
    if (!state || !validRegion) {
      throw new Error(`Invalid state_code ${shippingInfo?.state_code ?? ''} for country ${country}`);
    }
  }

  return { country, state };
}