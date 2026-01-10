import { container } from 'tsyringe';
import OAuthLoginUseCase from '../../../application/use-cases/OAuthLoginUseCase';
import GithubStrategyWrapper from './strategies/GitHubStrategy';
import GoogleStrategyWrapper from './strategies/GoogleStrategy';
import MicrosoftStrategyWrapper from './strategies/MicrosoftStrategy';
import passport from 'passport';

const oauthLoginUseCase = container.resolve(OAuthLoginUseCase);

if(process.env.GITHUB_CLIENT_ID){
    passport.use(new GithubStrategyWrapper(oauthLoginUseCase).getStrategy());
}

if(process.env.GOGLE_CLIENT_ID){
    passport.use(new GoogleStrategyWrapper(oauthLoginUseCase).getStrategy());
}

if(process.env.MICROSOFT_CLIENT_ID){
    passport.use(new MicrosoftStrategyWrapper(oauthLoginUseCase).getStrategy());
}