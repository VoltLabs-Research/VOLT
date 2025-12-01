/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Get encryption key from environment variable
 * If not set, throw an error in production or use a default in development
 */
const getEncryptionKey = (): Buffer => {
    const keyString = process.env.SSH_ENCRYPTION_KEY;

    if (!keyString) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('SSH_ENCRYPTION_KEY environment variable is required in production');
        }
        // Development fallback - DO NOT USE IN PRODUCTION
        console.warn('WARNING: Using default encryption key. Set SSH_ENCRYPTION_KEY in production!');
        return crypto.scryptSync('default-dev-key-change-me', 'salt', KEY_LENGTH);
    }

    // Derive a proper encryption key from the provided string
    return crypto.scryptSync(keyString, 'opendxa-ssh', KEY_LENGTH);
};

/**
 * Encrypt text using AES-256-GCM
 * Returns: salt:iv:encrypted:authTag (all base64 encoded)
 */
export const encrypt = (text: string): string => {
    try {
        const salt = crypto.randomBytes(SALT_LENGTH);
        const iv = crypto.randomBytes(IV_LENGTH);
        const key = getEncryptionKey();

        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        let encrypted = cipher.update(text, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        const authTag = cipher.getAuthTag();

        // Combine salt, iv, encrypted data, and auth tag
        return [
            salt.toString('base64'),
            iv.toString('base64'),
            encrypted,
            authTag.toString('base64')
        ].join(':');
    } catch (error: any) {
        throw new Error(`Encryption failed: ${error.message}`);
    }
};

/**
 * Decrypt text encrypted with encrypt()
 * Expects format: salt:iv:encrypted:authTag (all base64 encoded)
 */
export const decrypt = (encryptedText: string): string => {
    try {
        const parts = encryptedText.split(':');

        if (parts.length !== 4) {
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
    } catch (error: any) {
        throw new Error(`Decryption failed: ${error.message}`);
    }
};

/**
 * Hash a string using SHA-256
 * Useful for generating consistent IDs from strings
 */
export const hash = (text: string): string => {
    return crypto.createHash('sha256').update(text).digest('hex');
};
