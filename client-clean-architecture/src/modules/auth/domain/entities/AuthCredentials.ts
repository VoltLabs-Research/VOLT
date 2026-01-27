export interface SignInCredentials {
    email: string;
    password: string;
}

export interface SignUpDetails {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    passwordConfirm?: string;
}

export interface AuthResponse {
    user: import('./User').User;
    token: string;
}

export interface PasswordInfo {
    hasPassword: boolean;
    lastChanged?: string;
}

export interface ChangePasswordPayload {
    currentPassword?: string;
    newPassword: string;
}

export interface CheckEmailResult {
    exists: boolean;
    hasPassword: boolean;
}
