// lib/utils/image.js

export const isValidImage = (rawImage) => {
  // Only block if there is literally no data
  if (!rawImage || typeof rawImage !== 'string' || rawImage.trim() === '') {
    return false;
  }

  // Ensure it's not the word "null" or "undefined" as a string
  const lower = rawImage.toLowerCase().trim();
  if (lower === 'null' || lower === 'undefined') return false;

  // Otherwise, let it through to the Card component
  return true;
};