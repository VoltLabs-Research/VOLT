export interface ITokenStorage {
    setToken(token: string): void;
    getToken(): string | null;
    removeToken(): void;
    hasToken(): boolean;
}
