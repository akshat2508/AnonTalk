import CryptoJS from 'crypto-js';
import 'react-native-get-random-values';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface EncryptedMessage {
  content: string;
  iv: string;
  sender_public_key?: string;
}

interface KeyPair {
  publicKey: string;
  privateKey: string;
}

interface RoomKey {
  key: string;
  roomId: string;
}

class EncryptionManager {
  private keyPair: KeyPair | null = null;
  private roomKeys: Map<string, string> = new Map();
  private isInitialized = false;
  private supabase: any; // Add supabase client reference

  constructor(supabaseClient?: any) {
    this.supabase = supabaseClient;
    this.initializeManager();
  }

  // Set supabase client if not provided in constructor
  setSupabaseClient(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  private async initializeManager() {
    try {
      await this.loadKeyPair();
      await this.loadRoomKeys();
      this.isInitialized = true;
      console.log('🔐 Encryption manager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize encryption manager:', error);
      // Create new key pair if loading fails
      await this.generateKeyPair();
      this.isInitialized = true;
    }
  }

  private generateSecureRandom(length: number): string {
    // Use crypto-js for secure random generation
    const randomWords = CryptoJS.lib.WordArray.random(length);
    return randomWords.toString();
  }

  private async generateKeyPair(): Promise<KeyPair> {
    try {
      console.log('🔑 Generating new key pair...');
      
      // Generate a simple but secure key pair using crypto-js
      const privateKey = this.generateSecureRandom(32); // 256 bits
      const publicKey = CryptoJS.SHA256(privateKey + 'public').toString();
      
      const keyPair: KeyPair = {
        privateKey,
        publicKey
      };

      this.keyPair = keyPair;
      
      // Save to AsyncStorage
      await AsyncStorage.setItem('encryption_keypair', JSON.stringify(keyPair));
      
      console.log('✅ Key pair generated and saved');
      return keyPair;
    } catch (error) {
      console.error('❌ Error generating key pair:', error);
      throw new Error('Failed to generate key pair');
    }
  }

  async loadKeyPair(): Promise<void> {
    try {
      console.log('📂 Loading key pair from storage...');
      
      const storedKeyPair = await AsyncStorage.getItem('encryption_keypair');
      
      if (storedKeyPair) {
        this.keyPair = JSON.parse(storedKeyPair);
        console.log('✅ Key pair loaded from storage');
      } else {
        console.log('🔑 No existing key pair found, generating new one...');
        await this.generateKeyPair();
      }
    } catch (error) {
      console.error('❌ Error loading key pair:', error);
      // Generate new key pair if loading fails
      await this.generateKeyPair();
    }
  }

  async getPublicKey(): Promise<string> {
    if (!this.keyPair) {
      await this.loadKeyPair();
    }
    return this.keyPair?.publicKey || '';
  }

  // Generate a shared room key (same for all participants)
  private generateSharedRoomKey(): string {
    return this.generateSecureRandom(32); // 256 bits - truly random
  }

  // Store encrypted room key in database
  async storeRoomKey(roomId: string, roomKey: string, userId: string): Promise<void> {
  try {
    if (!this.supabase) {
      console.warn('⚠️ Supabase client not available, storing room key locally only');
      return;
    }

    const privateKey = this.keyPair?.privateKey;
    if (!privateKey) throw new Error('Private key not available');

    // Encrypt roomKey using the privateKey (shared secret approach)
    const encryptedRoomKey = CryptoJS.AES.encrypt(roomKey, privateKey).toString();

    const { error } = await this.supabase
      .from('room_keys')
      .upsert({
        room_id: roomId,
        participant_public_key: this.keyPair?.publicKey,
        encrypted_room_key: encryptedRoomKey,
        shared_by: userId
      });

    if (error) {
      console.error('❌ Error storing room key in database:', error);
    } else {
      console.log('✅ Room key stored in database');
    }
  } catch (error) {
    console.error('❌ Error storing room key:', error);
  }
}

  // Retrieve room key from database
  async retrieveRoomKey(roomId: string): Promise<string | null> {
  try {
    if (!this.supabase) {
      console.warn('⚠️ Supabase client not available');
      return null;
    }

    const privateKey = this.keyPair?.privateKey;
    if (!privateKey) throw new Error('Private key not available');

    const publicKey = await this.getPublicKey();

    const { data, error } = await this.supabase
      .from('room_keys')
      .select('encrypted_room_key')
      .eq('room_id', roomId)
      .eq('participant_public_key', publicKey)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('❌ Error retrieving room key:', error);
      }
      return null;
    }

    if (data?.encrypted_room_key) {
      const decrypted = CryptoJS.AES.decrypt(data.encrypted_room_key, privateKey);
      const roomKey = decrypted.toString(CryptoJS.enc.Utf8);

      if (roomKey) {
        console.log('✅ Room key retrieved and decrypted');
        return roomKey;
      } else {
        console.warn('⚠️ Failed to decrypt room key');
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Error retrieving room key:', error);
    return null;
  }
}


  async receiveRoomKey(roomId: string, userId?: string): Promise<void> {
    try {
      console.log(`🔐 Setting up room key for room: ${roomId}`);
      
      if (!this.keyPair) {
        await this.loadKeyPair();
      }

      // Check if we already have this room key
      let roomKey = this.roomKeys.get(roomId);
      
      if (roomKey) {
        console.log('✅ Room key already exists locally');
        return;
      }

      // Try to retrieve from database
    roomKey = (await this.retrieveRoomKey(roomId)) ?? undefined;
      
      if (!roomKey) {
        // Generate new room key (first user in room)
        roomKey = this.generateSharedRoomKey();
        console.log('🔑 Generated new shared room key');
        
        // Store in database if userId is provided
        if (userId) {
          await this.storeRoomKey(roomId, roomKey, userId);
        }
      }

      // Store locally
      this.roomKeys.set(roomId, roomKey);
      
      // Save room keys to storage
      await this.saveRoomKeysToStorage();
      
      console.log('✅ Room key setup completed');
    } catch (error) {
      console.error('❌ Error setting up room key:', error);
      throw new Error('Failed to setup room key');
    }
  }

  // Share room key with new participant
  async shareRoomKey(roomId: string, recipientPublicKey: string, userId: string): Promise<void> {
    try {
      const roomKey = this.roomKeys.get(roomId);
      if (!roomKey) {
        throw new Error('No room key available to share');
      }

      // Encrypt room key with recipient's public key
      const encryptedRoomKey = CryptoJS.AES.encrypt(roomKey, recipientPublicKey).toString();
      
      // Store in database
      const { error } = await this.supabase
        .from('room_keys')
        .upsert({
          room_id: roomId,
          participant_public_key: recipientPublicKey,
          encrypted_room_key: encryptedRoomKey,
          shared_by: userId
        });

      if (error) {
        console.error('❌ Error sharing room key:', error);
        throw error;
      }

      console.log('✅ Room key shared with new participant');
    } catch (error) {
      console.error('❌ Error sharing room key:', error);
      throw error;
    }
  }

  async encryptMessage(message: string, roomId: string): Promise<EncryptedMessage> {
    try {
      if (!this.keyPair) {
        throw new Error('No key pair available');
      }

      const roomKey = this.roomKeys.get(roomId);
      if (!roomKey) {
        throw new Error(`No room key available for room ${roomId}`);
      }
      
      // Generate IV for this message
      const iv = this.generateSecureRandom(16); // 128 bits
      
      // Encrypt the message using AES with the room key
      const encrypted = CryptoJS.AES.encrypt(message, roomKey, {
        iv: CryptoJS.enc.Hex.parse(iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      const encryptedMessage: EncryptedMessage = {
        content: encrypted.toString(),
        iv: iv,
        sender_public_key: this.keyPair.publicKey
      };

      console.log('✅ Message encrypted successfully');
      return encryptedMessage;
    } catch (error) {
      console.error('❌ Error encrypting message:', error);
      throw error;
    }
  }

  async decryptMessage(encryptedMessage: EncryptedMessage, roomId: string): Promise<string> {
    try {
      const roomKey = this.roomKeys.get(roomId);
      if (!roomKey) {
        throw new Error(`No room key available for room ${roomId}`);
      }
      
      // Decrypt the message
      const decrypted = CryptoJS.AES.decrypt(encryptedMessage.content, roomKey, {
        iv: CryptoJS.enc.Hex.parse(encryptedMessage.iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!decryptedText) {
        throw new Error('Failed to decrypt message - invalid key or corrupted data');
      }

      console.log('✅ Message decrypted successfully');
      return decryptedText;
    } catch (error) {
      console.error('❌ Error decrypting message:', error);
      throw error;
    }
  }

  clearRoomKey(roomId: string): void {
    this.roomKeys.delete(roomId);
    // Update storage
    this.saveRoomKeysToStorage();
    console.log(`🗑️ Room key cleared for room: ${roomId}`);
  }

  async clearAllKeys(): Promise<void> {
    try {
      this.keyPair = null;
      this.roomKeys.clear();
      await AsyncStorage.removeItem('encryption_keypair');
      await AsyncStorage.removeItem('room_keys');
      console.log('🗑️ All encryption keys cleared');
    } catch (error) {
      console.error('❌ Error clearing keys:', error);
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.keyPair !== null;
  }

  // Save room keys to AsyncStorage
  private async saveRoomKeysToStorage(): Promise<void> {
    try {
      const roomKeysObj = Object.fromEntries(this.roomKeys);
      await AsyncStorage.setItem('room_keys', JSON.stringify(roomKeysObj));
    } catch (error) {
      console.error('❌ Error saving room keys to storage:', error);
    }
  }

  // Initialize room keys from storage
  async loadRoomKeys(): Promise<void> {
    try {
      const storedRoomKeys = await AsyncStorage.getItem('room_keys');
      if (storedRoomKeys) {
        const roomKeysObj = JSON.parse(storedRoomKeys);
        this.roomKeys = new Map(Object.entries(roomKeysObj));
        console.log('✅ Room keys loaded from storage');
      }
    } catch (error) {
      console.error('❌ Error loading room keys:', error);
    }
  }

  // Debug method to check room keys
  getRoomKeyInfo(roomId: string): { hasKey: boolean; keyPreview?: string } {
    const roomKey = this.roomKeys.get(roomId);
    return {
      hasKey: !!roomKey,
      keyPreview: roomKey ? roomKey.substring(0, 8) + '...' : undefined
    };
  }
}

// Export singleton instance
export const encryption = new EncryptionManager();

// Also export the class for testing
export { EncryptionManager };