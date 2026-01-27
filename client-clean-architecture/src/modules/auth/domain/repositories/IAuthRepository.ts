import type {
    User,
    SignInCredentials,
    SignUpDetails,
    AuthResponse,
    PasswordInfo,
    ChangePasswordPayload,
    CheckEmailResult
} from '../entities';

export interface IAuthRepository {
    getMe(): Promise<User>;
    signIn(credentials: SignInCredentials): Promise<AuthResponse>;
    signUp(details: SignUpDetails): Promise<AuthResponse>;
    checkEmail(email: string): Promise<CheckEmailResult>;
    getGuestIdentity(seed: string): Promise<User>;
    updateMe(data: Partial<User> | FormData): Promise<User>;
    getPasswordInfo(): Promise<PasswordInfo>;
    changePassword(payload: ChangePasswordPayload): Promise<void>;
}
