import AuthService from '@modules/auth/services/AuthService';
import GithubStrategyWrapper from '@modules/auth/oauth/strategies/GitHubStrategy';
import GoogleStrategyWrapper from '@modules/auth/oauth/strategies/GoogleStrategy';
import MicrosoftStrategyWrapper from '@modules/auth/oauth/strategies/MicrosoftStrategy';
import passport from 'passport';

export { getConfiguredOAuthProviders } from '@modules/auth/oauth/providers';

let configured = false;

export const configureOAuthStrategies = (): void => {
    if (configured) {
        return;
    }
    configured = true;

    const authService = new AuthService();

    if (process.env.GITHUB_CLIENT_ID) {
        passport.use(new GithubStrategyWrapper(authService).getStrategy());
    }

    if (process.env.GOOGLE_CLIENT_ID) {
        passport.use(new GoogleStrategyWrapper(authService).getStrategy());
    }

    if (process.env.MICROSOFT_CLIENT_ID) {
        passport.use(new MicrosoftStrategyWrapper(authService).getStrategy());
    }
};

export default configureOAuthStrategies;
