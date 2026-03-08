import OAuthLoginUseCase from '@modules/auth/application/use-cases/OAuthLoginUseCase';
import GithubStrategyWrapper from '@modules/auth/infrastructure/http/oauth/strategies/GitHubStrategy';
import GoogleStrategyWrapper from '@modules/auth/infrastructure/http/oauth/strategies/GoogleStrategy';
import MicrosoftStrategyWrapper from '@modules/auth/infrastructure/http/oauth/strategies/MicrosoftStrategy';
import { container } from 'tsyringe';
import passport from 'passport';

const oauthLoginUseCase = container.resolve(OAuthLoginUseCase);

if (process.env.GITHUB_CLIENT_ID) {
    passport.use(new GithubStrategyWrapper(oauthLoginUseCase).getStrategy());
}

if (process.env.GOOGLE_CLIENT_ID) {
    passport.use(new GoogleStrategyWrapper(oauthLoginUseCase).getStrategy());
}

if (process.env.MICROSOFT_CLIENT_ID) {
    passport.use(new MicrosoftStrategyWrapper(oauthLoginUseCase).getStrategy());
}
