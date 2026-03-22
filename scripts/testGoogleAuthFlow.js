import dotenv from 'dotenv';
dotenv.config();

import { createOrUpdateUser } from '../lib/auth.js';
import { connectToDatabase } from '../lib/mongodb.js';

async function testGoogleAuthFlow() {
  console.log('🧪 Testing Google OAuth user creation flow...\n');

  // Simulate Google OAuth user data
  const googleUserData = {
    email: `googletest${Date.now()}@gmail.com`,
    name: 'Google Test User',
    image: 'https://lh3.googleusercontent.com/a/default-user',
    googleId: `google_${Date.now()}`,
    authMethod: 'google',
    lastLoginAt: new Date()
  };

  try {
    console.log('📧 Creating user with Google data:');
    console.log('Email:', googleUserData.email);
    console.log('Name:', googleUserData.name);
    console.log('');

    const user = await createOrUpdateUser(googleUserData);

    console.log('✅ User created successfully!');
    console.log('User ID:', user._id);
    console.log('Username (slug):', user.username);
    console.log('Email:', user.email);
    console.log('Display Name:', user.profile?.displayName);
    console.log('Avatar:', user.profile?.avatar);
    console.log('');
    console.log('📍 Aisle URL:', `http://localhost:3000/aisle/${user.username}`);
    console.log('');

    // Verify in database
    const { db } = await connectToDatabase();
    const dbUser = await db.collection('users').findOne({ _id: user._id });
    
    console.log('🔍 Verification from database:');
    console.log('Username exists:', !!dbUser.username);
    console.log('Profile structure:', !!dbUser.profile);
    console.log('Has googleId:', !!dbUser.googleId);
    console.log('');

    // Test duplicate detection (should update, not create new)
    console.log('🧪 Testing update existing user...');
    const updatedUser = await createOrUpdateUser({
      ...googleUserData,
      name: 'Google Test User Updated'
    });

    if (updatedUser._id === user._id) {
      console.log('✅ Correctly updated existing user (no duplicate created)');
    } else {
      console.log('❌ ERROR: Created duplicate user!');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }

  process.exit(0);
}

testGoogleAuthFlow();
