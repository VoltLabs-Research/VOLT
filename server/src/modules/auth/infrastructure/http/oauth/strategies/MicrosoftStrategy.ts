import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import OAuthLoginUseCase from '@modules/auth/application/use-cases/OAuthLoginUseCase';
import { OAuthProvider } from '@modules/auth/domain/entities/User';
import BaseOAuthStrategy from '@modules/auth/infrastructure/http/oauth/BaseOAuthStrategy';
import type { Profile } from 'passport';

interface MicrosoftProfileJSON {
    mail?: string;
    userPrincipalName?: string;
}

interface MicrosoftProfile extends Profile {
    _json?: MicrosoftProfileJSON;
}

export default class MicrosoftStrategyWrapper extends BaseOAuthStrategy<MicrosoftProfile> {
    constructor(oauthLoginUseCase: OAuthLoginUseCase) {
        super(OAuthProvider.Microsoft, oauthLoginUseCase, {
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
