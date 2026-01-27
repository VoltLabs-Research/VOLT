import type { ITokenStorage } from '../../domain/repositories/ITokenStorage';
import Logger from '@/shared/infrastructure/services/Logger';

export class TokenStorage implements ITokenStorage {
    private static readonly TOKEN_KEY = 'authToken';
    private static readonly logger: Logger = new Logger('token-storage');

    setToken(token: string): void {
        try {
            if (typeof window !== 'undefined') {
                localStorage.setItem(TokenStorage.TOKEN_KEY, token);
            }
        } catch (error) {
            TokenStorage.logger.error('Failed to save token:', error);
        }
    }

    getToken(): string | null {
        try {
            if (typeof window !== 'undefined') {
                return localStorage.getItem(TokenStorage.TOKEN_KEY);
            }
        } catch (error) {
            TokenStorage.logger.error('Failed to get token:', error);
        }
        return null;
    }

    removeToken(): void {
        try {
            if (typeof window !== 'undefined') {
                localStorage.removeItem(TokenStorage.TOKEN_KEY);
            }
        } catch (error) {
            TokenStorage.logger.error('Failed to remove token:', error);
        }
    }

    hasToken(): boolean {
        return !!this.getToken();
    }
}

// Singleton instance
export const tokenStorage = new TokenStorage();
