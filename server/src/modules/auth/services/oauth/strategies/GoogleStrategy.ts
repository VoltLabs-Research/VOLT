import { OAuthProvider } from '@modules/auth/models/UserModel';
import type AuthService from '@modules/auth/services/AuthService';
import BaseOAuthStrategy from '@modules/auth/services/oauth/BaseOAuthStrategy';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import type { Request } from 'express';
import type { GoogleCallbackParameters, Profile, VerifyCallback } from 'passport-google-oauth20';

export default class GoogleStrategyWrapper extends BaseOAuthStrategy<Profile> {
    constructor(authService: AuthService) {
        super(OAuthProvider.Google, authService, {
            map: (profile) => ({
                email: profile.emails?.[0]?.value,
                firstName: profile.name?.givenName,
                lastName: profile.name?.familyName,
                avatar: profile.photos?.[0]?.value
            })
        });
    }

    public getStrategy() {
        return new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            callbackURL: process.env.GOOGLE_CALLBACK_URL!,
            scope: ['profile', 'email'],
            passReqToCallback: true
        }, (
            request: Request,
            accessToken: string,
            refreshToken: string,
            _params: GoogleCallbackParameters,
            profile: Profile,
            done: VerifyCallback
        ) => {
            this.verify(request, accessToken, refreshToken, profile, done).catch(done);
        });
    }
}
