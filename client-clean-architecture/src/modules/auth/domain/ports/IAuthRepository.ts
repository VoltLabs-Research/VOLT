import {
    AuthResponse,
    ChangePasswordPayload,
    EmailCheckResult,
    PasswordInfo,
    SignInCredentials,
    SignUpDetails,
    User
} from '../entities/auth';

export default interface IAuthRepository{
    getMe(): Promise<User>;
    signIn(data: SignInCredentials): Promise<AuthResponse>;
    signUp(data: SignUpDetails): Promise<AuthResponse>;
    checkEmail(email: string): Promise<EmailCheckResult>;
    getGuestIdentity(seed: string): Promise<User>;
    updateMe(data: Partial<User> | FormData): Promise<User>;
    getPasswordInfo(): Promise<PasswordInfo>;
    changePassword(data: ChangePasswordPayload): Promise<void>;
};