export enum SessionActivityType{
    Login = 'login',
    Logout = 'logout',
    FailedLogin = 'failed_login',
    OAuthLogin = 'oauth_login',
    PasswordUpdate= 'password_update'
};

export interface SessionProps{
    user: string | null;
    token: string | null;
    userAgent: string;
    ip: string;
    isActive: boolean;
    lastActivity: Date;
    action: SessionActivityType,
    success: boolean;
    failureReason?: string;
    createdAt: Date;
    updatedAt: Date;
};

export default class Session{
    constructor(
        public readonly _id: string,
        public props: SessionProps
    ){}
};
