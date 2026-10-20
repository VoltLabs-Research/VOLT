import { readStoredString, removeStoredValue, writeStoredString } from '@/shared/utils/local-storage';
const TOKEN_KEY = 'authToken';

class TokenStorage {
    getToken(): string | null {
        return readStoredString(TOKEN_KEY);
    }

    setToken(token: string): void {
        writeStoredString(TOKEN_KEY, token);
    }

    removeToken(): void {
        removeStoredValue(TOKEN_KEY);
    }
};

export const tokenStorage = new TokenStorage();
