import dotenv from 'dotenv';
dotenv.config();

import { createOrUpdateUser } from '../lib/auth.js';
import { connectToDatabase } from '../lib/mongodb.js';

async function testWalletAuthFlow() {
  console.log('🧪 Testing Wallet authentication user creation flow...\n');

  // Simulate wallet authentication data
  const walletUserData = {
    walletAddress: `ALGO${Date.now().toString().slice(-10)}TEST7777777777777777777`,
    authMethod: 'wallet',
    lastLoginAt: new Date()
  };

  try {
    console.log('🔐 Creating user with Wallet data:');
    console.log('Wallet Address:', walletUserData.walletAddress);
    console.log('');

    const user = await createOrUpdateUser(walletUserData);

    console.log('✅ User created successfully!');
    console.log('User ID:', user._id);
    console.log('Username (slug):', user.username);
    console.log('Wallet Address:', user.walletAddress);
    console.log('Display Name:', user.profile?.displayName);
    console.log('');
    console.log('📍 Aisle URL:', `http://localhost:3000/aisle/${user.username}`);
    console.log('');

    // Verify in database
    const { db } = await connectToDatabase();
    const dbUser = await db.collection('users').findOne({ _id: user._id });
    
    console.log('🔍 Verification from database:');
    console.log('Username exists:', !!dbUser.username);
    console.log('Username format:', dbUser.username?.startsWith('wallet-') ? 'Correct (wallet-)' : 'Unexpected format');
    console.log('Profile structure:', !!dbUser.profile);
    console.log('Has walletAddress:', !!dbUser.walletAddress);
    console.log('Auth method:', dbUser.authMethod);
    console.log('');

    // Test duplicate detection (should update, not create new)
    console.log('🧪 Testing update existing user (subsequent login)...');
    const updatedUser = await createOrUpdateUser({
      ...walletUserData,
      lastLoginAt: new Date()
    });

    if (updatedUser._id === user._id) {
      console.log('✅ Correctly updated existing user (no duplicate created)');
      console.log('   Same user ID:', updatedUser._id);
    } else {
      console.log('❌ ERROR: Created duplicate user!');
      console.log('   Original ID:', user._id);
      console.log('   New ID:', updatedUser._id);
    }
    console.log('');

    // Test username uniqueness
    console.log('🧪 Testing username uniqueness...');
    if (dbUser.username && dbUser.username.length > 0) {
      const duplicateCheck = await db.collection('users').countDocuments({ 
        username: dbUser.username 
      });
      
      if (duplicateCheck === 1) {
        console.log('✅ Username is unique in database');
      } else {
        console.log(`❌ ERROR: Found ${duplicateCheck} users with username "${dbUser.username}"`);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }

  process.exit(0);
}

testWalletAuthFlow();
