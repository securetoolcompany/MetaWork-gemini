import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { nanoid } from 'nanoid';

/**
 * Cart Session Management Helper
 * 
 * Handles session management for both guest and logged-in users.
 * - Guest users: Uses sessionId stored in HTTP-only cookie
 * - Logged-in users: Uses userId from JWT auth token
 */

// Cookie configuration
const COOKIE_NAME = 'metawork_cart_session';
const AUTH_TOKEN_NAME = 'auth_token';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

/**
 * Get or create a session ID for guest carts
 * @returns {Promise<{sessionId: string, isNew: boolean}>}
 */
export async function getOrCreateSessionId() {
  const cookieStore = await cookies();
  const existingSessionId = cookieStore.get(COOKIE_NAME)?.value;
  
  if (existingSessionId) {
    return { sessionId: existingSessionId, isNew: false };
  }
  
  // Create new session ID using nanoid
  const newSessionId = nanoid(21);
  
  return { sessionId: newSessionId, isNew: true };
}

/**
 * Set the session ID cookie
 * @param {string} sessionId - The session ID to store
 */
export async function setSessionCookie(sessionId) {
  const cookieStore = await cookies();
  
  cookieStore.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/'
  });
}

/**
 * Clear the session ID cookie (used after cart merge)
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Get the current session ID from cookies (if exists)
 * @returns {Promise<string|null>}
 */
export async function getSessionId() {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

/**
 * Get the current user session from JWT auth token
 * @returns {Promise<{userId: string|null, email: string|null}>}
 */
export async function getUserSession() {
  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get(AUTH_TOKEN_NAME)?.value;
    
    if (!authToken) {
      return { userId: null, email: null };
    }
    
    const decoded = verifyToken(authToken);
    
    if (decoded) {
      return {
        userId: decoded.userId || decoded.id || decoded.sub || null,
        email: decoded.email || null
      };
    }
    
    return { userId: null, email: null };
  } catch (error) {
    console.error('Error getting user session:', error);
    return { userId: null, email: null };
  }
}

/**
 * Get the MongoDB query for finding the current user's cart
 * Handles both logged-in users (by userId) and guests (by sessionId)
 * 
 * @returns {Promise<{query: Object, userId: string|null, sessionId: string|null, isGuest: boolean}>}
 */
export async function getCartQuery() {
  const { userId } = await getUserSession();
  const sessionId = await getSessionId();
  
  if (userId) {
    // Logged-in user - query by userId
    return {
      query: { userId },
      userId,
      sessionId,
      isGuest: false
    };
  }
  
  if (sessionId) {
    // Guest user - query by sessionId
    return {
      query: { sessionId },
      userId: null,
      sessionId,
      isGuest: true
    };
  }
  
  // No session at all - will create new guest session
  return {
    query: null,
    userId: null,
    sessionId: null,
    isGuest: true
  };
}

/**
 * Check if a cart merge is needed (user is logged in AND has guest cart cookie)
 * @returns {Promise<{needsMerge: boolean, userId: string|null, sessionId: string|null}>}
 */
export async function checkCartMerge() {
  const { userId } = await getUserSession();
  const sessionId = await getSessionId();
  
  // Merge is needed when user is logged in AND has a guest session cookie
  return {
    needsMerge: !!(userId && sessionId),
    userId,
    sessionId
  };
}
