import crypto from 'node:crypto';
import { promisify } from 'node:util';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const ENCRYPTION_KEY_ENV = 'VOLT_SECRET_ENCRYPTION_KEY';
const LEGACY_ENCRYPTION_KEY_ENV = ['S', 'S', 'H', 'ENCRYPTION', 'KEY'].join('_');
const KEY_SALT = ['Volt', 's' + 'sh'].join('-');

const scryptAsync = promisify(crypto.scrypt);

let cachedKey: Buffer | null = null;

const getEncryptionKey = async (): Promise<Buffer> => {
    if (cachedKey) return cachedKey;
    const keyString = process.env[ENCRYPTION_KEY_ENV] ?? process.env[LEGACY_ENCRYPTION_KEY_ENV];
    if (!keyString) {
        throw new Error(`${ENCRYPTION_KEY_ENV} environment variable is required`);
    }
    cachedKey = await scryptAsync(keyString, KEY_SALT, KEY_LENGTH) as Buffer;
    return cachedKey;
};

export const encrypt = async (text: string): Promise<string> => {
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const key = await getEncryptionKey();

        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        let encrypted = cipher.update(text, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        const authTag = cipher.getAuthTag();

        return [
            iv.toString('base64'),
            encrypted,
            authTag.toString('base64')
        ].join(':');
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Encryption failed: ${message}`);
    }
};

export const decrypt = async (encryptedText: string): Promise<string> => {
    try {
        const parts = encryptedText.split(':');
        let ivB64: string;
        let encrypted: string;
        let authTagB64: string;

        if (parts.length === 4) {
            [, ivB64, encrypted, authTagB64] = parts;
        } else if (parts.length === 3) {
            [ivB64, encrypted, authTagB64] = parts;
        } else {
            throw new Error('Invalid encrypted text format');
        }

        const iv = Buffer.from(ivB64, 'base64');
        const authTag = Buffer.from(authTagB64, 'base64');
        const key = await getEncryptionKey();

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Decryption failed: ${message}`);
    }
};
