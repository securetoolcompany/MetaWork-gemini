const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function generatePlaceholderUrl(type, text, width, height, colors) {
  // Returns Cloudinary placeholder URL
  const baseUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`;
  return `${baseUrl}/c_fill,w_${width},h_${height},g_center/l_text:Arial_${Math.floor(height/5)}_bold:${encodeURIComponent(text)},co_rgb:${colors.text}/b_rgb:${colors.bg}/placeholder.png`;
}

module.exports = { cloudinary, generatePlaceholderUrl };
