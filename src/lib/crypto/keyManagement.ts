/**
 * Secure Key Management
 * 
 * Handles:
 * - Private key storage in IndexedDB (encrypted)
 * - Public key publishing to database
 * - Key derivation from password
 * - Device identity management
 */

import { get, set, del } from 'idb-keyval';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import {
  KeyPair,
  DeviceIdentity,
  generateKeyPair,
  generateDeviceId,
  calculateFingerprint,
  exportKeyPair,
  importKeyPair
} from './encryption';

const DEVICE_IDENTITY_KEY = 'e2ee_device_identity';
const ENCRYPTED_KEYPAIR_KEY = 'e2ee_encrypted_keypair';

/**
 * Derive encryption key from password using PBKDF2-like approach
 * 
 * In production, use Argon2id. For web compatibility, we use:
 * - PBKDF2 via Web Crypto API (100k iterations)
 * - Random salt per device
 * 
 * @param password - User's password/passphrase
 * @param salt - Random salt (generate once per device)
 */
const deriveKeyFromPassword = async (
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000, // 100k iterations
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

/**
 * Encrypt private key with password-derived key
 */
const encryptPrivateKey = async (
  secretKey: Uint8Array,
  password: string
): Promise<{ encrypted: string; salt: string; iv: string }> => {
  // Generate random salt and IV
  const salt = nacl.randomBytes(32);
  const iv = nacl.randomBytes(12);

  // Derive encryption key from password
  const derivedKey = await deriveKeyFromPassword(password, salt);

  // Encrypt secret key with AES-GCM
  const ivBuffer = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer;
  const secretBuffer = secretKey.buffer.slice(secretKey.byteOffset, secretKey.byteOffset + secretKey.byteLength) as ArrayBuffer;
  
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: ivBuffer
    },
    derivedKey,
    secretBuffer
  );

  return {
    encrypted: encodeBase64(new Uint8Array(encrypted)),
    salt: encodeBase64(salt),
    iv: encodeBase64(iv)
  };
};

/**
 * Decrypt private key with password
 */
const decryptPrivateKey = async (
  encryptedData: { encrypted: string; salt: string; iv: string },
  password: string
): Promise<Uint8Array> => {
  const salt = new Uint8Array(decodeBase64(encryptedData.salt));
  const iv = new Uint8Array(decodeBase64(encryptedData.iv));
  const encrypted = new Uint8Array(decodeBase64(encryptedData.encrypted));

  // Derive decryption key from password
  const derivedKey = await deriveKeyFromPassword(password, salt);

  try {
    // Decrypt secret key
    const ivBuffer = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer;
    const encryptedBuffer = encrypted.buffer.slice(encrypted.byteOffset, encrypted.byteOffset + encrypted.byteLength) as ArrayBuffer;
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer
      },
      derivedKey,
      encryptedBuffer
    );

    return new Uint8Array(decrypted);
  } catch (error) {
    throw new Error('Invalid password or corrupted key data');
  }
};

/**
 * Initialize device identity (first-time setup)
 * 
 * Generates:
 * - X25519 keypair for E2EE
 * - Unique device ID
 * - Key fingerprint for verification
 * 
 * @param password - Password to encrypt private key
 * @returns Device identity with public information
 */
export const initializeDeviceIdentity = async (
  password: string
): Promise<DeviceIdentity> => {
  // Generate new keypair
  const keyPair = generateKeyPair();
  const deviceId = generateDeviceId();
  const fingerprint = calculateFingerprint(new Uint8Array(keyPair.publicKey));

  // Encrypt and store private key
  const encryptedKey = await encryptPrivateKey(new Uint8Array(keyPair.secretKey), password);
  await set(ENCRYPTED_KEYPAIR_KEY, encryptedKey);

  // Store device identity (public info only)
  const identity: DeviceIdentity = {
    deviceId,
    keyPair, // Will be cleared after public key upload
    fingerprint,
    createdAt: Date.now()
  };

  await set(DEVICE_IDENTITY_KEY, {
    deviceId,
    fingerprint,
    createdAt: identity.createdAt,
    publicKey: encodeBase64(keyPair.publicKey)
  });

  return identity;
};

/**
 * Load device identity from storage
 * Returns public info without private key
 */
export const loadDeviceIdentity = async (): Promise<DeviceIdentity | null> => {
  const stored = await get(DEVICE_IDENTITY_KEY);
  if (!stored) return null;

  return {
    deviceId: stored.deviceId,
    keyPair: {
      publicKey: new Uint8Array(decodeBase64(stored.publicKey)),
      secretKey: new Uint8Array(0) // Not loaded yet
    },
    fingerprint: stored.fingerprint,
    createdAt: stored.createdAt
  };
};

/**
 * Unlock private key with password
 * This is called when user needs to decrypt messages
 * 
 * @param password - User's password
 * @returns Full keypair with decrypted private key
 */
export const unlockPrivateKey = async (password: string): Promise<KeyPair> => {
  const encryptedKey = await get(ENCRYPTED_KEYPAIR_KEY);
  if (!encryptedKey) {
    throw new Error('No encrypted key found - device not initialized');
  }

  const identity = await loadDeviceIdentity();
  if (!identity) {
    throw new Error('Device identity not found');
  }

  // Decrypt private key
  const secretKey = await decryptPrivateKey(encryptedKey, password);

  return {
    publicKey: identity.keyPair.publicKey,
    secretKey
  };
};

/**
 * Check if device is initialized
 */
export const isDeviceInitialized = async (): Promise<boolean> => {
  const identity = await loadDeviceIdentity();
  return identity !== null;
};

/**
 * Get public key for publishing
 */
export const getPublicKey = async (): Promise<string | null> => {
  const identity = await loadDeviceIdentity();
  if (!identity) return null;
  return encodeBase64(identity.keyPair.publicKey);
};

/**
 * Clear all keys (logout or reset)
 */
export const clearKeys = async (): Promise<void> => {
  await del(DEVICE_IDENTITY_KEY);
  await del(ENCRYPTED_KEYPAIR_KEY);
};

/**
 * Re-encrypt private key with new password
 * Useful for password change
 */
export const changePassword = async (
  oldPassword: string,
  newPassword: string
): Promise<void> => {
  // Decrypt with old password
  const keyPair = await unlockPrivateKey(oldPassword);

  // Re-encrypt with new password
  const encryptedKey = await encryptPrivateKey(new Uint8Array(keyPair.secretKey), newPassword);
  await set(ENCRYPTED_KEYPAIR_KEY, encryptedKey);
};
