import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { v2 as cloudinary } from 'cloudinary';

export async function POST(request) {
  try {
    // 🔥 1. Check if variables exist
    console.log('\n🔍 [DEBUG] Cloudinary Env Check:', {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'MISSING',
      api_key: process.env.CLOUDINARY_API_KEY || 'MISSING',
      has_secret: !!process.env.CLOUDINARY_API_SECRET,
    });

    // 🔥 2. Configure Cloudinary INSIDE the route so it never caches undefined
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const token = request.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    
    const decoded = verifyToken(token);
    if (!decoded?.userId) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file');
    const resourceType = formData.get('type') || 'image';
    
    // Default to 'general' if no context is provided
    const folderContext = formData.get('folderContext') || 'general'; 
    
    if (!file) return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));
    
    // 🔥 FIX: Set 'MetaWork' as the root and append the context (e.g., users/123/mockups)
    const uploadFolder = `MetaWork/users/${decoded.userId}/${folderContext}`;

    console.log("🔥 [DEBUG] Uploading to folder:", uploadFolder);
    console.log("🔥 [DEBUG] Decoded Token:", decoded);

    const uploadOptions = {
      folder: uploadFolder,
      resource_type: resourceType,
    };

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error("Cloudinary stream error:", error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      stream.end(buffer);
    });
    
    return NextResponse.json({ 
      success: true,
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      name: file.name
    });
  } catch (error) {
    console.error('\n❌ Upload Error Detailed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Server error during upload' 
    }, { status: 500 });
  }
}