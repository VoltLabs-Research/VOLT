import authContainer from '@/src/modules/auth/infrastructure/di/container';
import OAuthLoginUseCase from '../../../application/use-cases/OAuthLoginUseCase';
import GithubStrategyWrapper from './strategies/GitHubStrategy';
import GoogleStrategyWrapper from './strategies/GoogleStrategy';
import MicrosoftStrategyWrapper from './strategies/MicrosoftStrategy';
import passport from 'passport';

const oauthLoginUseCase = authContainer.resolve(OAuthLoginUseCase);

if(process.env.GITHUB_CLIENT_ID){
    passport.use(new GithubStrategyWrapper(oauthLoginUseCase).getStrategy());
}

if(process.env.GOGLE_CLIENT_ID){
    passport.use(new GoogleStrategyWrapper(oauthLoginUseCase).getStrategy());
}

if(process.env.MICROSOFT_CLIENT_ID){
    passport.use(new MicrosoftStrategyWrapper(oauthLoginUseCase).getStrategy());
}