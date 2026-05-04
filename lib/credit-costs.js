/**
 * lib/credit-costs.js
 * Central registry of credit costs for all platform operations.
 * 1 credit = $0.01 USD
 * Update costs here — nowhere else needs to change.
 */

export const CREDITS_PER_DOLLAR = 100; // 1 credit = $0.01

export const CREDIT_COSTS = {
  MINT_IP:           25,  // $0.25
  AI_IMAGE_GEN:       2,  // $0.02
  FEATURED_LISTING:  10,  // $0.10 per day
  BOOST:              5,  // $0.05
};