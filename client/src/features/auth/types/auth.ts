export interface User {
    _id: string;
    username: string;
    email: string;
    [key: string]: any;
}

export interface AuthResponse {
    user: User;
    token: string;
}

export interface SignInCredentials {
    email: string;
    password: string;
}

export interface SignUpDetails {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    passwordConfirm: string;
}

export interface PasswordInfo {
    hasPassword: boolean;
    lastChanged?: string;
}

export interface ChangePasswordPayload {
    currentPassword?: string;
    newPassword: string;
}
