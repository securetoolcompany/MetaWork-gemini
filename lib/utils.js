import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Safely serialize and re-parse data to convert all BigInt values to strings.
 * Use this before passing data to JSON.stringify or NextResponse.json.
 * @param {any} data - The data to sanitize
 * @returns {any} - Data with all BigInt values converted to strings
 */
export function safeJson(data) {
  return JSON.parse(
    JSON.stringify(data, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );
}

export function sortSizes(sizes) {
  if (!sizes || !Array.isArray(sizes)) return [];
  
  const SIZE_ORDER = {
    '3XS': 1, '2XS': 2, 'XS': 3, 'S': 4, 'M': 5, 'L': 6, 
    'XL': 7, '2XL': 8, '3XL': 9, '4XL': 10, '5XL': 11, '6XL': 12
  };

  return [...sizes].sort((a, b) => {
    const orderA = SIZE_ORDER[a.toUpperCase()] || 99;
    const orderB = SIZE_ORDER[b.toUpperCase()] || 99;
    return orderA - orderB;
  });
}