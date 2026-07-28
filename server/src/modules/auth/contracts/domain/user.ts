export enum OAuthProvider {
    GitHub = 'github',
    Microsoft = 'microsoft',
    Google = 'google'
}

export enum UserRole {
    Admin = 'admin',
    User = 'user'
}

export interface SplitFullNameResult{
    firstName: string;
    lastName?: string;
}

export const normalizeEmail = (email: string): string => {
    return email.trim().toLowerCase();
};

export const normalizeName = (name: string): string => {
    return name.trim().toLowerCase();
};

export const splitFullName = (fullName: string): SplitFullNameResult => {
    const normalizedFullName = fullName.trim().replace(/\s+/g, ' ');
    const [firstName, ...lastNameParts] = normalizedFullName.split(' ');

    const splitName: SplitFullNameResult = {
        firstName: normalizeName(firstName)
    };

    if(lastNameParts.length > 0){
        splitName.lastName = normalizeName(lastNameParts.join(' '));
    }

    return splitName;
};
