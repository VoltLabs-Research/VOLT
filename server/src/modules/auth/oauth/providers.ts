import { OAuthProvider } from '@modules/auth/domain/OAuthProvider';

export const getConfiguredOAuthProviders = (): OAuthProvider[] => {
    const providers: OAuthProvider[] = [];

    if (process.env.GITHUB_CLIENT_ID) {
        providers.push(OAuthProvider.GitHub);
    }

    if (process.env.GOOGLE_CLIENT_ID) {
        providers.push(OAuthProvider.Google);
    }

    if (process.env.MICROSOFT_CLIENT_ID) {
        providers.push(OAuthProvider.Microsoft);
    }

    return providers;
};
