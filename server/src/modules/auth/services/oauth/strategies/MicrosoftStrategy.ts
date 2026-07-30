import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import type AuthService from '@modules/auth/services/AuthService';
import { OAuthProvider } from '@modules/auth/contracts/user';
import BaseOAuthStrategy from '@modules/auth/services/oauth/BaseOAuthStrategy';
import type { Profile } from 'passport';

interface MicrosoftProfileJSON {
    mail?: string;
    userPrincipalName?: string;
}

interface MicrosoftProfile extends Profile {
    _json?: MicrosoftProfileJSON;
}

export default class MicrosoftStrategyWrapper extends BaseOAuthStrategy<MicrosoftProfile> {
    constructor(authService: AuthService) {
        super(OAuthProvider.Microsoft, authService, {
            map: (profile) => {
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

    public getStrategy() {
        return new MicrosoftStrategy({
            clientID: process.env.MICROSOFT_CLIENT_ID!,
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
            callbackURL: process.env.MICROSOFT_CALLBACK_URL!,
            scope: ['user.read'],
            passReqToCallback: true
        }, this.verify.bind(this));
    }
}
