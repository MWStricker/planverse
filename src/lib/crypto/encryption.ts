/**
 * End-to-End Encryption System
 * 
 * Implementation based on NaCl (libsodium) authenticated encryption:
 * - X25519 for key agreement (ECDH)
 * - XSalsa20 for encryption
 * - Poly1305 for authentication
 * 
 * This provides:
 * - Confidentiality: Only intended recipient can read
 * - Authentication: Verifies sender identity
 * - Integrity: Detects tampering
 */

import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface EncryptedMessage {
  ciphertext: string; // Base64 encoded
  nonce: string; // Base64 encoded
  senderPublicKey: string; // Base64 encoded for verification
}

export interface DeviceIdentity {
  deviceId: string;
  keyPair: KeyPair;
  fingerprint: string;
  createdAt: number;
}

/**
 * Generate a new X25519 keypair for end-to-end encryption
 * This should be called once per device on first setup
 */
export const generateKeyPair = (): KeyPair => {
  return nacl.box.keyPair();
};

/**
 * Generate a unique device identifier
 */
export const generateDeviceId = (): string => {
  const randomBytes = nacl.randomBytes(16);
  return encodeBase64(randomBytes);
};

/**
 * Calculate fingerprint (safety number) for key verification
 * This is shown to users for out-of-band verification
 * 
 * Format: First 32 bytes of SHA-256(publicKey)
 */
export const calculateFingerprint = (publicKey: Uint8Array): string => {
  const hash = nacl.hash(publicKey).slice(0, 32);
  // Convert to readable hex format
  return Array.from(hash)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Format fingerprint as groups of 4 hex digits for display
 * Example: "a1b2 c3d4 e5f6 ..." (8 groups of 4)
 */
export const formatFingerprint = (fingerprint: string): string => {
  return fingerprint.match(/.{1,4}/g)?.join(' ') || fingerprint;
};

/**
 * Encrypt a message for a specific recipient
 * 
 * @param message - Plaintext message to encrypt
 * @param recipientPublicKey - Recipient's public key (Base64)
 * @param senderKeyPair - Sender's keypair
 * @returns Encrypted message envelope
 * 
 * Security properties:
 * - Each message uses a unique random nonce (replay protection)
 * - Authenticated encryption (recipient verifies sender)
 * - Forward secrecy would require key rotation (not implemented yet)
 */
export const encryptMessage = (
  message: string,
  recipientPublicKey: string,
  senderKeyPair: KeyPair
): EncryptedMessage => {
  // Generate unique nonce for this message
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  
  // Convert message to Uint8Array
  const encoder = new TextEncoder();
  const messageUint8 = encoder.encode(message);
  
  // Decrypt recipient's public key
  const recipientPubKey = new Uint8Array(decodeBase64(recipientPublicKey));
  
  // Encrypt using NaCl box (X25519 + XSalsa20-Poly1305)
  const encrypted = nacl.box(
    messageUint8,
    nonce,
    recipientPubKey,
    new Uint8Array(senderKeyPair.secretKey)
  );
  
  if (!encrypted) {
    throw new Error('Encryption failed');
  }
  
  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
    senderPublicKey: encodeBase64(senderKeyPair.publicKey)
  };
};

/**
 * Decrypt a message from a sender
 * 
 * @param encrypted - Encrypted message envelope
 * @param senderPublicKey - Sender's public key for verification (Base64)
 * @param recipientKeyPair - Recipient's keypair
 * @returns Decrypted plaintext message
 * 
 * Throws if:
 * - Authentication fails (message was tampered with or wrong sender)
 * - Decryption fails (wrong recipient or corrupted data)
 */
export const decryptMessage = (
  encrypted: EncryptedMessage,
  senderPublicKey: string,
  recipientKeyPair: KeyPair
): string => {
  try {
    // Decode all components
    const ciphertext = new Uint8Array(decodeBase64(encrypted.ciphertext));
    const nonce = new Uint8Array(decodeBase64(encrypted.nonce));
    const senderPubKey = new Uint8Array(decodeBase64(senderPublicKey));
    
    // Decrypt and authenticate
    const decrypted = nacl.box.open(
      ciphertext,
      nonce,
      senderPubKey,
      new Uint8Array(recipientKeyPair.secretKey)
    );
    
    if (!decrypted) {
      throw new Error('Decryption failed - invalid signature or corrupted data');
    }
    
    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt message - possible tampering or wrong keys');
  }
};

/**
 * Encrypt file/attachment data
 * 
 * @param fileData - File as Uint8Array
 * @param recipientPublicKey - Recipient's public key (Base64)
 * @param senderKeyPair - Sender's keypair
 * @returns Encrypted file data
 */
export const encryptFile = (
  fileData: Uint8Array,
  recipientPublicKey: string,
  senderKeyPair: KeyPair
): EncryptedMessage => {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const recipientPubKey = new Uint8Array(decodeBase64(recipientPublicKey));
  
  const encrypted = nacl.box(
    fileData,
    nonce,
    recipientPubKey,
    new Uint8Array(senderKeyPair.secretKey)
  );
  
  if (!encrypted) {
    throw new Error('File encryption failed');
  }
  
  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
    senderPublicKey: encodeBase64(senderKeyPair.publicKey)
  };
};

/**
 * Decrypt file/attachment data
 */
export const decryptFile = (
  encrypted: EncryptedMessage,
  senderPublicKey: string,
  recipientKeyPair: KeyPair
): Uint8Array => {
  const ciphertext = new Uint8Array(decodeBase64(encrypted.ciphertext));
  const nonce = new Uint8Array(decodeBase64(encrypted.nonce));
  const senderPubKey = new Uint8Array(decodeBase64(senderPublicKey));
  
  const decrypted = nacl.box.open(
    ciphertext,
    nonce,
    senderPubKey,
    new Uint8Array(recipientKeyPair.secretKey)
  );
  
  if (!decrypted) {
    throw new Error('File decryption failed');
  }
  
  return decrypted;
};

/**
 * Export keypair to Base64 for storage
 */
export const exportKeyPair = (keyPair: KeyPair): { publicKey: string; secretKey: string } => {
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: encodeBase64(keyPair.secretKey)
  };
};

/**
 * Import keypair from Base64 storage
 */
export const importKeyPair = (exported: { publicKey: string; secretKey: string }): KeyPair => {
  return {
    publicKey: decodeBase64(exported.publicKey),
    secretKey: decodeBase64(exported.secretKey)
  };
};
