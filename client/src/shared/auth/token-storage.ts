const TOKEN_KEY = 'authToken';

export default class TokenStorage {
    getToken(): string | null {
        return localStorage.getItem(TOKEN_KEY);
    }

    setToken(token: string): void {
        localStorage.setItem(TOKEN_KEY, token);
    }

    removeToken(): void {
        localStorage.removeItem(TOKEN_KEY);
    }
};

/** Shared singleton — import this instead of constructing `new TokenStorage()`. */
export const tokenStorage = new TokenStorage();
