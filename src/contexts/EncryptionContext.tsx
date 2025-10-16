import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { KeyPair } from '@/lib/crypto/encryption';
import { 
  initializeDeviceIdentity, 
  unlockPrivateKey, 
  isDeviceInitialized,
  getPublicKey,
  loadDeviceIdentity
} from '@/lib/crypto/keyManagement';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface EncryptionContextType {
  keyPair: KeyPair | null;
  isUnlocked: boolean;
  isInitializing: boolean;
  deviceId: string | null;
  fingerprint: string | null;
}

const EncryptionContext = createContext<EncryptionContextType | undefined>(undefined);

export const EncryptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, user } = useAuth();
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  useEffect(() => {
    const initializeEncryption = async () => {
      if (!session || !user) {
        // User logged out - clear keys
        setKeyPair(null);
        setIsUnlocked(false);
        setDeviceId(null);
        setFingerprint(null);
        return;
      }

      setIsInitializing(true);

      try {
        const sessionToken = session.access_token;
        const deviceInitialized = await isDeviceInitialized();

        // CHECK: Does the user's profile have encryption keys?
        const { data: profile } = await supabase
          .from('profiles')
          .select('public_key, device_id')
          .eq('user_id', user.id)
          .single();

        const profileMissingKeys = !profile?.public_key || !profile?.device_id;

        if (!deviceInitialized || profileMissingKeys) {
          // Generate keys (either first time OR for legacy users)
          console.log('🔐 Setting up encryption...', { 
            deviceInitialized, 
            profileMissingKeys 
          });
          
          const identity = await initializeDeviceIdentity(sessionToken);
          
          // Upload public key to profile
          const publicKeyBase64 = await getPublicKey();
          const { error } = await supabase
            .from('profiles')
            .update({
              public_key: publicKeyBase64,
              device_id: identity.deviceId,
              key_fingerprint: identity.fingerprint
            })
            .eq('user_id', user.id);

          if (error) {
            throw new Error(`Failed to upload public key: ${error.message}`);
          }

          setKeyPair(identity.keyPair);
          setDeviceId(identity.deviceId);
          setFingerprint(identity.fingerprint);
          setIsUnlocked(true);
          console.log('✅ Encryption initialized successfully');
        } else {
          // Device already has keys - unlock them
          console.log('🔓 Unlocking existing encryption keys...');
          const unlockedKeyPair = await unlockPrivateKey(sessionToken);
          const identity = await loadDeviceIdentity();
          
          setKeyPair(unlockedKeyPair);
          setDeviceId(identity?.deviceId || null);
          setFingerprint(identity?.fingerprint || null);
          setIsUnlocked(true);
          console.log('✅ Encryption unlocked successfully');
        }
      } catch (error) {
        console.error('❌ Encryption initialization failed:', error);
        toast({
          title: "Encryption Required",
          description: "Message encryption could not be set up. Please contact support.",
          variant: "destructive"
        });
        // Don't clear keys here - keep trying
      } finally {
        setIsInitializing(false);
      }
    };

    initializeEncryption();
  }, [session, user]);

  return (
    <EncryptionContext.Provider
      value={{
        keyPair,
        isUnlocked,
        isInitializing,
        deviceId,
        fingerprint
      }}
    >
      {children}
    </EncryptionContext.Provider>
  );
};

export const useEncryption = () => {
  const context = useContext(EncryptionContext);
  if (!context) {
    throw new Error('useEncryption must be used within EncryptionProvider');
  }
  return context;
};
