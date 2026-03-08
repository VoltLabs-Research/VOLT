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
    lastLoginAt: Date;
    lastSeenAt?: Date | null;
    role?: UserRole;
    passwordChangedAt?: Date;
    teams: string[];
    analyses: string[];
    firstName: string;
    lastName: string;
    createdAt: Date;
    updatedAt: Date;
    avatar?: string;
    
    password?: string;

    oauthProvider?: OAuthProvider;
    oauthId?: string;
};

export interface SplitFullNameResult {
    firstName: string;
    lastName?: string;
};

export default class User{
    constructor(
        public readonly _id: string,
        public props: UserProps
    ) {}

    public static normalizeEmail(email: string): string {
        return email.trim().toLowerCase();
    }

    public static normalizeName(name: string): string {
        return name.trim().toLowerCase();
    }

    public static splitFullName(fullName: string): SplitFullNameResult {
        const normalizedFullName = fullName.trim().replace(/\s+/g, ' ');
        const [firstName, ...lastNameParts] = normalizedFullName.split(' ');

        const splitName: SplitFullNameResult = {
            firstName: User.normalizeName(firstName),
        };

        if (lastNameParts.length > 0) {
            splitName.lastName = User.normalizeName(lastNameParts.join(' '));
        }

        return splitName;
    }

    public get id(): string {
        return this._id;
    }

    public isPasswordChangedAfterTokenIssued(jwtTimestamp: number): boolean{
        if(this.props.passwordChangedAt){
            const changedTimestamp = Math.floor(this.props.passwordChangedAt.getTime() / 1000);
            return jwtTimestamp < changedTimestamp;
        }

        return false;
    }
};
