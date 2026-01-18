import { OAuthProvider } from '@modules/auth/domain/entities/User';
import BaseOAuthStrategy from '@modules/auth/infrastructure/http/passport/BaseOAuthStrategy';
import OAuthLoginUseCase from '@modules/auth/application/use-cases/OAuthLoginUseCase';
import { Strategy as GithubStrategy } from 'passport-github2';

export default class GithubStrategyWrapper extends BaseOAuthStrategy{
    constructor(oauthLoginUseCase: OAuthLoginUseCase){
        super(OAuthProvider.GitHub, oauthLoginUseCase, {
            map: (profile) => ({
                email: profile.emails?.[0]?.value,
                firstName: profile.displayName?.split(' ')[0],
                lastName: profile.displayName?.split(' ').slice(1).join(' '),
                avatar: profile.photos?.[0]?.value
            })
        });
    }

    public getStrategy(){
        return new GithubStrategy({
            clientID: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            callbackURL: process.env.GITHUB_CALLBACK_URL!,
            scope: ['user:email'],
            passReqToCallback: true
        }, this.verify.bind(this));
    }
};