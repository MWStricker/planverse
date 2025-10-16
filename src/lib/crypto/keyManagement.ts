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
 * Derive encryption key from Supabase session (transparent encryption)
 * 
 * Uses session.access_token + device ID to derive a key
 * This allows automatic encryption without user passwords
 * 
 * @param sessionToken - Supabase session access token
 * @param deviceId - Unique device identifier
 */
const deriveKeyFromSession = async (
  sessionToken: string,
  deviceId: string
): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const combinedKey = `${sessionToken}:${deviceId}`;
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(combinedKey),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  // Use a deterministic salt derived from device ID
  const salt = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(deviceId)
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

/**
 * Encrypt private key with session-derived key
 */
const encryptPrivateKey = async (
  secretKey: Uint8Array,
  sessionToken: string,
  deviceId: string
): Promise<{ encrypted: string; salt: string; iv: string }> => {
  // Generate random IV (salt is deterministic from device ID)
  const salt = nacl.randomBytes(32);
  const iv = nacl.randomBytes(12);

  // Derive encryption key from session
  const derivedKey = await deriveKeyFromSession(sessionToken, deviceId);

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
 * Decrypt private key with session token
 */
const decryptPrivateKey = async (
  encryptedData: { encrypted: string; salt: string; iv: string },
  sessionToken: string,
  deviceId: string
): Promise<Uint8Array> => {
  const iv = new Uint8Array(decodeBase64(encryptedData.iv));
  const encrypted = new Uint8Array(decodeBase64(encryptedData.encrypted));

  // Derive decryption key from session
  const derivedKey = await deriveKeyFromSession(sessionToken, deviceId);

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
    throw new Error('Invalid session or corrupted key data');
  }
};

/**
 * Initialize device identity (transparent - no password needed)
 * 
 * Generates:
 * - X25519 keypair for E2EE
 * - Unique device ID
 * - Key fingerprint for verification
 * 
 * @param sessionToken - Supabase session access token
 * @returns Device identity with public information
 */
export const initializeDeviceIdentity = async (
  sessionToken: string
): Promise<DeviceIdentity> => {
  // Generate new keypair
  const keyPair = generateKeyPair();
  const deviceId = generateDeviceId();
  const fingerprint = calculateFingerprint(new Uint8Array(keyPair.publicKey));

  // Encrypt and store private key using session
  const encryptedKey = await encryptPrivateKey(
    new Uint8Array(keyPair.secretKey), 
    sessionToken, 
    deviceId
  );
  await set(ENCRYPTED_KEYPAIR_KEY, encryptedKey);

  // Store device identity (public info only)
  const identity: DeviceIdentity = {
    deviceId,
    keyPair,
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
 * Unlock private key with session token (transparent)
 * This is called automatically when user is logged in
 * 
 * @param sessionToken - Supabase session access token
 * @returns Full keypair with decrypted private key
 */
export const unlockPrivateKey = async (sessionToken: string): Promise<KeyPair> => {
  const encryptedKey = await get(ENCRYPTED_KEYPAIR_KEY);
  if (!encryptedKey) {
    throw new Error('No encrypted key found - device not initialized');
  }

  const identity = await loadDeviceIdentity();
  if (!identity) {
    throw new Error('Device identity not found');
  }

  // Decrypt private key using session
  const secretKey = await decryptPrivateKey(encryptedKey, sessionToken, identity.deviceId);

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
 * Re-encrypt private key with new session (for session refresh)
 * Called automatically when session is refreshed
 */
export const reencryptWithNewSession = async (
  oldSessionToken: string,
  newSessionToken: string
): Promise<void> => {
  const identity = await loadDeviceIdentity();
  if (!identity) {
    throw new Error('Device identity not found');
  }

  // Decrypt with old session
  const keyPair = await unlockPrivateKey(oldSessionToken);

  // Re-encrypt with new session
  const encryptedKey = await encryptPrivateKey(
    new Uint8Array(keyPair.secretKey), 
    newSessionToken,
    identity.deviceId
  );
  await set(ENCRYPTED_KEYPAIR_KEY, encryptedKey);
};
