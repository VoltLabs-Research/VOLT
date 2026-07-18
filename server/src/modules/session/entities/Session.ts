export interface SessionProps {
    user: string | null;
    token: string | null;
    userAgent: string;
    ip: string;
    isActive: boolean;
    lastActivity: Date;
    action: SessionActivityType;
    success: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export enum SessionActivityType {
    Login = 'login',
    FailedLogin = 'failed_login',
    OAuthLogin = 'oauth_login',
    PasswordUpdate= 'password_update'
}

export interface Session {
    readonly _id: string;
    props: SessionProps;
}

export const createSession = (_id: string, props: SessionProps): Session => ({
    _id,
    props
});

export default Session;
