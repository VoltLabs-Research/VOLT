import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;

/**
 * Get encryption key from environment variable.
 * If not set, throw an error.
 */
const getEncryptionKey = (): Buffer => {
    const keyString = process.env.SSH_ENCRYPTION_KEY;
    if(!keyString){
        throw new Error('SSH_ENCRYPTION_KEY environment variable is required');
    }
    return crypto.scryptSync(keyString, 'volterra-ssh', KEY_LENGTH);
};

/**
 * Encrypt text using the specified algorithm.
 * Returns: salt:iv:encrypted:authTag (base64 encoded).
 */
export const encrypt = (text: string): string => {
    try{
        const salt = crypto.randomBytes(SALT_LENGTH);
        const iv = crypto.randomBytes(IV_LENGTH);
        const key = getEncryptionKey();

        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        let encrypted = cipher.update(text, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        const authTag = cipher.getAuthTag();

        return [
            salt.toString('base64'),
            iv.toString('base64'),
            encrypted,
            authTag.toString('base64')
        ].join(':');
    }catch(error: any){
        throw new Error(`Encryption failed: ${error.message}`);
    }
};

/**
 * Decrypt text encrypted with encrypt().
 */
export const decrypt = (encryptedText: string): string => {
    try{
        const parts = encryptedText.split(':');
        if(parts.length != 4){
            throw new Error('Invalid encrypted text format');
        }
        
        const [saltB64, ivB64, encrypted, authTagB64] = parts;
        const iv = Buffer.from(ivB64, 'base64');
        const authTag = Buffer.from(authTagB64, 'base64');
        const key = getEncryptionKey();

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }catch(error: any){
        throw new Error(`Decryption failed: ${error.message}`);
    }
};
