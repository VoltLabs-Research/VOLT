import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import BaseOAuthStrategy from '../BaseOAuthStrategy';
import OAuthLoginUseCase from '@/src/modules/auth/application/use-cases/OAuthLoginUseCase';
import { OAuthProvider } from '@/src/modules/auth/domain/entities/User';

export default class MicrosoftStrategyWrapper extends BaseOAuthStrategy{
    constructor(oauthLoginUseCase: OAuthLoginUseCase){
        super(OAuthProvider.Microsoft, oauthLoginUseCase, {
            map: (profile) => {
                // Microsoft is quite special...
                const email = profile.emails?.[0]?.value 
                              || profile._json?.mail 
                              || profile._json?.userPrincipalName;
                return {
                    email,
                    firstName: profile.name?.givenName,
                    lastName: profile.name?.familyName,
                    avatar: undefined
                };
            }
        });
    }

    public getStrategy(){
        return new MicrosoftStrategy({
            clientID: process.env.MICROSOFT_CLIENT_ID!,
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
            callbackURL: process.env.MICROSOFT_CALLBACL_URL!,
            scope: ['user.read'],
            passReqToCallback: true
        }, this.verify.bind(this));
    }
};