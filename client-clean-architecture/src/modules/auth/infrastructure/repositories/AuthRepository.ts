import { BaseRepository } from '@/shared/infrastructure/repositories/BaseRepository';
import type { IAuthRepository } from '../../domain/repositories/IAuthRepository';
import type {
    User,
    SignInCredentials,
    SignUpDetails,
    AuthResponse,
    PasswordInfo,
    ChangePasswordPayload,
    CheckEmailResult
} from '../../domain/entities';

export class AuthRepository extends BaseRepository implements IAuthRepository {
    constructor() {
        super('/auth');
    }

    async getMe(): Promise<User> {
        return this.get<User>('/me');
    }

    async signIn(credentials: SignInCredentials): Promise<AuthResponse> {
        return this.post<AuthResponse>('/sign-in', credentials);
    }

    async signUp(details: SignUpDetails): Promise<AuthResponse> {
        return this.post<AuthResponse>('/sign-up', details);
    }

    async checkEmail(email: string): Promise<CheckEmailResult> {
        return this.post<CheckEmailResult>('/check-email', { email });
    }

    async getGuestIdentity(seed: string): Promise<User> {
        return this.get<User>(`/guest-identity?seed=${seed}`);
    }

    async updateMe(data: Partial<User> | FormData): Promise<User> {
        const isFormData = data instanceof FormData;
        return this.patch<User>('/me', data, {
            config: {
                headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined
            }
        });
    }

    async getPasswordInfo(): Promise<PasswordInfo> {
        return this.get<PasswordInfo>('/password/info');
    }

    async changePassword(payload: ChangePasswordPayload): Promise<void> {
        await this.patch('/me/update/password/', payload);
    }
}

// Singleton instance
export const authRepository = new AuthRepository();
