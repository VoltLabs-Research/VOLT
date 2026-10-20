export interface CredentialProvider {
    getToken(): string | null | Promise<string | null>;
};
