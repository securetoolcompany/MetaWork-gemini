import jwt from 'jsonwebtoken';
import { connectToDatabase } from './mongodb.js';
import { generateSlugFromEmail, generateSlugFromWallet, generateUniqueSlug } from './utils/generateSlug.js';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'metawork-secret-key';
const JWT_EXPIRY = '30d';

export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export async function getUserFromToken(token) {
  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) {
    return null;
  }
  
  const { db } = await connectToDatabase();
  const user = await db.collection('users').findOne({ _id: decoded.userId });
  if (user) user.id = user._id;
  return user;
}

/**
 * Creates or updates a user with prioritized merge logic.
 * If a wallet account exists, it becomes the primary record to preserve IP/Products.
 */
export async function createOrUpdateUser(userData) {
  const { db } = await connectToDatabase();
  const now = new Date();
  
  console.log('=== CREATE OR UPDATE USER ===');
  
  // 1. Identify existing accounts
  // Check for wallet account (The priority record for IP/Products)
  const walletUser = userData.walletAddress 
    ? await db.collection('users').findOne({
        $or: [
          { walletAddress: userData.walletAddress },
          { "wallets.address": userData.walletAddress }
        ]
      })
    : null;

  // Check for email/google account
  const emailUser = userData.email 
    ? await db.collection('users').findOne({ email: userData.email })
    : null;

  // CASE 1: MERGE SCENARIO - Both exist but are different records
  // We merge the email/google identity INTO the wallet account to preserve wallet-linked assets.
  if (walletUser && emailUser && walletUser._id !== emailUser._id) {
    console.log('MERGE: Integrating Email account into Wallet account');
    
    const updateData = {
      email: emailUser.email || userData.email,
      googleId: emailUser.googleId || userData.googleId,
      lastLoginAt: now,
      updatedAt: now
    };

    // Preserve profile data if wallet account is sparse
    if (!walletUser.profile?.avatar && (emailUser.profile?.avatar || userData.image)) {
      updateData['profile.avatar'] = emailUser.profile?.avatar || userData.image;
    }
    if (!walletUser.profile?.displayName && (emailUser.profile?.displayName || userData.name)) {
      updateData['profile.displayName'] = emailUser.profile?.displayName || userData.name;
    }

    await db.collection('users').updateOne(
      { _id: walletUser._id },
      { 
        $set: updateData,
        $addToSet: { authMethods: { $each: emailUser.authMethods || [userData.authMethod] } }
      }
    );

    // Note: In a production environment, you may want to mark emailUser as 'merged' or delete it.
    const mergedUser = await db.collection('users').findOne({ _id: walletUser._id });
    mergedUser.id = mergedUser._id;
    return mergedUser;
  }

  // CASE 2: Wallet User exists (Regular Wallet Login or Google Login into Wallet Account)
  if (walletUser) {
    console.log('Updating existing Wallet User');
    const updateData = { lastLoginAt: now, updatedAt: now };
    
    if (userData.googleId) updateData.googleId = userData.googleId;
    if (userData.email) updateData.email = userData.email;

    await db.collection('users').updateOne(
      { _id: walletUser._id },
      { 
        $set: updateData,
        $addToSet: { authMethods: userData.authMethod }
      }
    );
    const updatedUser = await db.collection('users').findOne({ _id: walletUser._id });
    updatedUser.id = updatedUser._id;
    return updatedUser;
  }

  // CASE 3: Email User exists (Adding a new wallet or regular Google login)
  if (emailUser) {
    console.log('Updating existing Email User');
    const updateData = { lastLoginAt: now, updatedAt: now };
    
    const updateOp = { 
      $set: updateData,
      $addToSet: { authMethods: userData.authMethod }
    };

    if (userData.walletAddress) {
      // Groundwork for multi-chain: Store as object in wallets array
      updateOp.$addToSet.wallets = { 
        address: userData.walletAddress, 
        chain: userData.chain || 'algorand',
        linkedAt: now 
      };
      // Maintain legacy field for compatibility
      updateOp.$set.walletAddress = userData.walletAddress;
    }

    await db.collection('users').updateOne({ _id: emailUser._id }, updateOp);
    const updatedUser = await db.collection('users').findOne({ _id: emailUser._id });
    updatedUser.id = updatedUser._id;
    return updatedUser;
  }

  // CASE 4: Brand New User
  console.log('Creating new user');
  let username;
  if (userData.walletAddress) {
    username = await generateSlugFromWallet(userData.walletAddress, db);
  } else if (userData.email) {
    username = await generateSlugFromEmail(userData.email, db);
  } else {
    username = await generateUniqueSlug(userData.name || 'user', db);
  }

  const userId = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const newUser = {
    _id: userId,
    id: userId,
    username,
    authMethod: userData.authMethod || 'email',
    authMethods: [userData.authMethod || 'email'],
    wallets: userData.walletAddress ? [{
      address: userData.walletAddress,
      chain: userData.chain || 'algorand',
      linkedAt: now
    }] : [],
    walletAddress: userData.walletAddress || null, // Legacy support
    profile: {
      displayName: userData.name || userData.email?.split('@')[0] || 'User',
      bio: '',
      avatar: userData.image || '',
      socialLinks: {}
    },
    membershipTier: 'free',
    createdAt: now,
    updatedAt: now
  };

  if (userData.email) newUser.email = userData.email;
  if (userData.googleId) newUser.googleId = userData.googleId;

  await db.collection('users').insertOne(newUser);
  return newUser;
}

/**
 * Links a new wallet to an existing user record.
 * Supports multi-chain groundwork.
 */
export async function linkWalletToUser(userId, walletAddress, chain = 'algorand') {
  const { db } = await connectToDatabase();
  const now = new Date();

  console.log('--- LINK WALLET DB DEBUG ---');
  console.log('Target User ID:', userId);
  console.log('Wallet to Add:', walletAddress);
  
  console.log(`=== LINKING ${chain.toUpperCase()} WALLET ===`);
  
  // Check if this wallet is already claimed by another account
  const existingOwner = await db.collection('users').findOne({
    _id: { $ne: userId },
    $or: [
      { walletAddress: walletAddress },
      { "wallets.address": walletAddress }
    ]
  });

  if (existingOwner) {
    throw new Error('This wallet is already linked to another account');
  }
  
// Check if the user exists BEFORE trying to update
  const userCheck = await db.collection('users').findOne({ _id: userId });
  if (!userCheck) {
    console.log('❌ ERROR: No user found with _id:', userId);
    throw new Error(`User ${userId} not found`);
  }

  const result = await db.collection('users').updateOne(
    { _id: userId },
    { 
      $set: { walletAddress, updatedAt: now },
      $addToSet: { 
        wallets: { address: walletAddress, chain, linkedAt: now } 
      }
    }
  );

  console.log('Matched Count:', result.matchedCount);
  console.log('Modified Count:', result.modifiedCount);
  
  const user = await db.collection('users').findOne({ _id: userId });
  user.id = user._id;
  return user;
}

export async function unlinkWalletFromUser(userId, walletAddress) {
  const { db } = await connectToDatabase();
  
  // If no specific address provided, clear the legacy primary wallet
  if (!walletAddress) {
    await db.collection('users').updateOne(
      { _id: userId },
      { 
        $unset: { walletAddress: '', walletLinkedAt: '' },
        $set: { updatedAt: new Date() }
      }
    );
  } else {
    // Remove specific wallet from the array
    await db.collection('users').updateOne(
      { _id: userId },
      { 
        $pull: { wallets: { address: walletAddress } },
        $set: { updatedAt: new Date() }
      }
    );
  }
  
  const user = await db.collection('users').findOne({ _id: userId });
  user.id = user._id;
  return user;
}