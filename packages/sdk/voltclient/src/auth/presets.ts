import type { CredentialProvider } from './CredentialProvider';

export const staticToken = (token: string): CredentialProvider => ({
    getToken: () => token
});

export const secretKey = (key: string): CredentialProvider => ({
    getToken: () => key
});

export const dynamicToken = (getter: () => string | null | Promise<string | null>): CredentialProvider => ({
    getToken: getter
});
