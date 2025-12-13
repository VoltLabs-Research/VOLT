import Logger from '@/services/logger';

export class TokenStorage{
    private static readonly TOKEN_KEY = 'authToken';
    private static readonly logger: Logger = new Logger('token-storage');

    static setToken(token: string): void{
        try{
            if(typeof window !== 'undefined'){
                localStorage.setItem(this.TOKEN_KEY, token);
            }
        }catch(error){
            this.logger.error('Failed to save token:', error);
        }
    }

    static getToken(): string | null{
        try{
            if(typeof window !== 'undefined'){
                return localStorage.getItem(this.TOKEN_KEY);
            }
        }catch(error){
            this.logger.error('Failed to get token:', error);
        }

        return null;
    }

    static removeToken(): void{
        try{
            if(typeof window !== 'undefined'){
                localStorage.removeItem(this.TOKEN_KEY);
            }
        }catch(error){
            this.logger.error('Failed to remove token:', error);
        }
    }

    static hasToken(): boolean{
        return !!this.getToken();
    }
}
