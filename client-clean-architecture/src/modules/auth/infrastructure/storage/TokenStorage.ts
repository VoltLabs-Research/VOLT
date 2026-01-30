import { injectable } from 'tsyringe';

const TOKEN_KEY = 'authToken';

@injectable()
export default class TokenStorage{
    getToken(): string | null{
        return localStorage.getItem(TOKEN_KEY);
    }

    setToken(token: string): void{
        localStorage.setItem(TOKEN_KEY, token);
    }

    removeToken(): void{
        localStorage.removeItem(TOKEN_KEY);
    }
};