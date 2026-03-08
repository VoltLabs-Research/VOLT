import { Strategy as GoogleStrategy, type VerifyCallback, type Profile, type GoogleCallbackParameters } from 'passport-google-oauth20';
import type { Request } from 'express';
import BaseOAuthStrategy from '@modules/auth/infrastructure/http/passport/BaseOAuthStrategy';
import OAuthLoginUseCase from '@modules/auth/application/use-cases/OAuthLoginUseCase';
import { OAuthProvider } from '@modules/auth/domain/entities/User';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

export default class GoogleStrategyWrapper extends BaseOAuthStrategy{
    constructor(oauthLoginUseCase: OAuthLoginUseCase){
        super(OAuthProvider.Google, oauthLoginUseCase, {
            map: (profile) => ({
                email: profile.emails?.[0]?.value,
                firstName: profile.name?.givenName,
                lastName: profile.name?.familyName,
                avatar: profile.photos?.[0]?.value
            })
        });
    }

    public getStrategy(){
        return new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            callbackURL: process.env.GOOGLE_CALLBACK_URL!,
            scope: ['profile', 'email'],
            passReqToCallback: true
        }, (request: Request, accessToken: string, refreshToken: string, _params: GoogleCallbackParameters, profile: Profile, done: VerifyCallback) => {
            void this.verify(request as AuthenticatedRequest, accessToken, refreshToken, profile, done);
        });
    }
};
