// lib/utils/generateSlug.js
import { getDatabase } from '../mongodb.js';

/**
 * Converts a string into a URL-safe slug
 * @param {string} text - Input text to slugify
 * @returns {string} URL-safe slug
 */
export function slugify(text) {
  if (!text) return '';
  
  return text
    .toString()
    .toLowerCase()
    .trim()
    // Remove accents/diacritics
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove all non-alphanumeric characters except hyphens
    .replace(/[^a-z0-9-]+/g, '')
    // Remove consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');
}

/**
 * Generates a unique username slug for the users collection
 * @param {string} baseName - Base name to generate slug from (name, email, etc.)
 * @param {Object} db - MongoDB database instance
 * @returns {Promise<string>} Unique username slug
 */
export async function generateUniqueSlug(baseName, db) {
  // If no database provided, get it
  if (!db) {
    db = await getDatabase();
  }
  
  const users = db.collection('users');
  
  // Create base slug
  let baseSlug = slugify(baseName);
  
  // Fallback if slug is empty after sanitization
  if (!baseSlug || baseSlug.length < 2) {
    baseSlug = `user-${Date.now().toString(36)}`;
  }
  
  // Check if base slug is available
  const existing = await users.findOne({ username: baseSlug });
  if (!existing) {
    return baseSlug;
  }
  
  // If taken, try with incremental suffixes
  let counter = 1;
  let uniqueSlug = `${baseSlug}-${counter}`;
  
  while (await users.findOne({ username: uniqueSlug })) {
    counter++;
    uniqueSlug = `${baseSlug}-${counter}`;
    
    // Safety check to prevent infinite loops
    if (counter > 1000) {
      // Use timestamp as last resort
      uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;
      break;
    }
  }
  
  return uniqueSlug;
}

/**
 * Generate slug from email address
 * @param {string} email - Email address
 * @param {Object} db - MongoDB database instance
 * @returns {Promise<string>} Unique username slug
 */
export async function generateSlugFromEmail(email, db) {
  if (!email || !email.includes('@')) {
    throw new Error('Invalid email address');
  }
  
  // Extract local part before @
  const localPart = email.split('@')[0];
  
  return generateUniqueSlug(localPart, db);
}

/**
 * Generate slug from wallet address
 * @param {string} walletAddress - Algorand wallet address
 * @param {Object} db - MongoDB database instance
 * @returns {Promise<string>} Unique username slug
 */
export async function generateSlugFromWallet(walletAddress, db) {
  if (!walletAddress) {
    throw new Error('Invalid wallet address');
  }
  
  // Use first 8 characters of wallet address
  const baseSlug = `wallet-${walletAddress.slice(0, 8).toLowerCase()}`;
  
  return generateUniqueSlug(baseSlug, db);
}
