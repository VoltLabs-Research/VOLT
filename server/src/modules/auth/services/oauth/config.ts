import { OAuthProvider } from '@modules/auth/contracts/domain/user';
import AuthService from '@modules/auth/services/AuthService';
import GithubStrategyWrapper from '@modules/auth/services/oauth/strategies/GitHubStrategy';
import GoogleStrategyWrapper from '@modules/auth/services/oauth/strategies/GoogleStrategy';
import MicrosoftStrategyWrapper from '@modules/auth/services/oauth/strategies/MicrosoftStrategy';
import passport from 'passport';

export const getConfiguredOAuthProviders = (): OAuthProvider[] => {
    const providers: OAuthProvider[] = [];

    if(process.env.GITHUB_CLIENT_ID) providers.push(OAuthProvider.GitHub);
    if(process.env.GOOGLE_CLIENT_ID) providers.push(OAuthProvider.Google);
    if(process.env.MICROSOFT_CLIENT_ID) providers.push(OAuthProvider.Microsoft);

    return providers;
};

let configured = false;

export const configureOAuthStrategies = (): void => {
    if(configured) return;
    configured = true;

    const authService = new AuthService();

    if(process.env.GITHUB_CLIENT_ID) passport.use(new GithubStrategyWrapper(authService).getStrategy());
    if(process.env.GOOGLE_CLIENT_ID) passport.use(new GoogleStrategyWrapper(authService).getStrategy());
    if(process.env.MICROSOFT_CLIENT_ID) passport.use(new MicrosoftStrategyWrapper(authService).getStrategy());
};
