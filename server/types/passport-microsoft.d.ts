declare module 'passport-microsoft' {
    import { Strategy as PassportStrategy } from 'passport';

    export interface Profile {
        id: string;
        displayName: string;
        name?: {
            givenName?: string;
            familyName?: string;
        };
        emails?: Array<{ value: string }>;
        photos?: Array<{ value: string }>;
        _json?: any;
    }

    export interface StrategyOptions {
        clientID: string;
        clientSecret: string;
        callbackURL: string;
        scope?: string[];
    }

    export type VerifyCallback = (error: any, user?: any, info?: any) => void;

    export type VerifyFunction = (
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: VerifyCallback
    ) => void;

    export class Strategy extends PassportStrategy{
        constructor(options: StrategyOptions, verify: VerifyFunction);
    }
}
