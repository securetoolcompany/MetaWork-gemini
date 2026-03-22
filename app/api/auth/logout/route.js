import { NextResponse } from 'next/server';

// Logout - clear auth cookie
export async function POST(request) {
  const response = NextResponse.json({ success: true });
  
  response.cookies.delete('auth_token');
  
  return response;
}
