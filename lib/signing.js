import algosdk from 'algosdk';
import nacl from 'tweetnacl';

export function generateNonce() {
  const array = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    const { randomBytes } = require('crypto');
    const bytes = randomBytes(32);
    array.set(bytes);
  }
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function verifyAlgorandSignature(messageStr, signatureBytes, address) {
  try {
    // Pera Wallet's signData uses algosdk.signBytes internally
    // signBytes prepends "MX" to the message before signing
    // So we need to verify against "MX" + message
    
    const messageBuffer = Buffer.from(messageStr, 'utf8');
    
    // Create the prefixed message that algosdk.signBytes signs
    // The prefix is "MX" (Message signing prefix)
    const prefix = Buffer.from('MX');
    const prefixedMessage = Buffer.concat([prefix, messageBuffer]);
    
    // Convert to proper Uint8Array
    const msgUint8 = new Uint8Array(prefixedMessage);
    
    // Ensure signature is proper Uint8Array
    const sigUint8 = new Uint8Array(
      signatureBytes.buffer || signatureBytes,
      signatureBytes.byteOffset || 0,
      signatureBytes.length
    );
    
    // Decode the Algorand address to get the public key
    const decoded = algosdk.decodeAddress(address);
    const pubKeyUint8 = new Uint8Array(decoded.publicKey);
    
    console.log('Verification with MX prefix:');
    console.log('- Prefixed message length:', msgUint8.length);
    console.log('- Signature length:', sigUint8.length);
    console.log('- Public key length:', pubKeyUint8.length);
    console.log('- First 4 bytes of prefixed message:', Array.from(msgUint8.slice(0, 4)));
    
    // Use tweetnacl directly for verification
    const isValid = nacl.sign.detached.verify(msgUint8, sigUint8, pubKeyUint8);
    
    console.log('Verification result (with MX prefix):', isValid);
    
    // If that didn't work, try without prefix (in case Pera changed behavior)
    if (!isValid) {
      console.log('Trying without MX prefix...');
      const rawMsgUint8 = new Uint8Array(messageBuffer);
      const isValidRaw = nacl.sign.detached.verify(rawMsgUint8, sigUint8, pubKeyUint8);
      console.log('Verification result (without prefix):', isValidRaw);
      return isValidRaw;
    }
    
    return isValid;
  } catch (error) {
    console.error('Signature verification error:', error.message);
    return false;
  }
}
export { verifyAlgorandSignature as verifySignature };