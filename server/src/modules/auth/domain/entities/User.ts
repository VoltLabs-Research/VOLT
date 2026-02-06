export enum OAuthProvider{
    GitHub = 'github',
    Microsoft = 'microsoft',
    Google = 'google'
};

export enum UserRole{
    Admin = 'admin',
    User = 'user'
};

export interface UserProps{
    email: string;
    lastLoginAt?: Date;
    role?: UserRole;
    passwordChangedAt?: Date;
    passwordResetToken?: string;
    passwordResetExpires?: Date;
    teams: string[];
    analyses: string[];
    firstName: string;
    lastName: string;
    createdAt: Date;
    updatedAt: Date;
    avatar?: string;
    
    // NOTE: The password is marked as optional given 
    // the existence of users authenticated with OAuth.
    password?: string;

    oauthProvider?: OAuthProvider;
    oauthId?: string;
};

export default class User{
    constructor(
        public readonly id: string,
        public props: UserProps
    ){}

    public static create(id: string, props: UserProps): User{
        return new User(id, props);
    }

    public isPasswordChangedAfterTokenIssued(jwtTimestamp: number): boolean{
        if(this.props.passwordChangedAt){
            const changedTimestamp = Math.floor(this.props.passwordChangedAt.getTime() / 1000);
            return jwtTimestamp < changedTimestamp;
        }

        return false;
    }
};