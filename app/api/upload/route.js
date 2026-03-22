import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { v2 as cloudinary } from 'cloudinary';

// Init (in lib or top-level)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request) {
  try {
    // Auth check
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const timestamp = Date.now();
    const ipId = `upload-${timestamp}-0`;
    
    const userFolder = `metawork/${decoded.userId}`;
    const uploadFolder = `${userFolder}/ip-assets/default`;

    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { 
          folder: uploadFolder,
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'png' }]  // Optimize for print
        },
        (error, result) => error ? reject(error) : resolve(result)
      ).end(buffer);
    });
    
    return NextResponse.json({ 
      success: true,
      id: ipId,
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      name: file.name,
      title: 'Uploaded Design',
      category: 'Upload',
      licensingFee: 0
    });
  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to upload file' 
    }, { status: 500 });
  }
}
