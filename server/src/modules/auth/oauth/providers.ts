import { OAuthProvider } from '@modules/auth/entities/User';

/**
 * The OAuth providers that are actually configured (their CLIENT_ID env var is
 * set). Single source of truth shared by passport strategy registration
 * ({@link configureOAuthStrategies}) and the public
 * `GET /api/auth/oauth/providers` endpoint ({@link AuthService.getOAuthProviders}),
 * so the sign-in page only shows buttons that can complete a login.
 *
 * Lives in its own leaf module (no service/use-case imports) so both the
 * strategy composition root and `AuthService` can read it without forming an
 * import cycle.
 */
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
