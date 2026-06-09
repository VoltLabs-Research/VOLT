import OAuthLoginUseCase from '@modules/auth/application/use-cases/OAuthLoginUseCase';
import GithubStrategyWrapper from '@modules/auth/infrastructure/http/oauth/strategies/GitHubStrategy';
import GoogleStrategyWrapper from '@modules/auth/infrastructure/http/oauth/strategies/GoogleStrategy';
import MicrosoftStrategyWrapper from '@modules/auth/infrastructure/http/oauth/strategies/MicrosoftStrategy';
import { container } from 'tsyringe';
import passport from 'passport';

let configured = false;

/**
 * Registers the OAuth passport strategies.
 *
 * This MUST run after `autoloadModules()` has finished, because resolving
 * `OAuthLoginUseCase` pulls in `TEAM_TOKENS.DefaultTeamEnroller`, which is only
 * registered when the team module's `@Singleton(...)` decorator fires during
 * autoload. The autoloader imports module files in filesystem order, visiting
 * `auth` before `team`, so resolving at import time crashed the boot with
 * "Attempted to resolve unregistered dependency token: Symbol(DefaultTeamEnroller)".
 *
 * The autoload phase should only fire registration decorators; eager container
 * consumers like this one run afterwards from the composition root.
 */
export const configureOAuthStrategies = (): void => {
    if (configured) {
        return;
    }
    configured = true;

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
};

export default configureOAuthStrategies;
