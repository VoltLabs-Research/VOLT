import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import IAuthRepository from '../../domain/ports/IAuthRepository';
import {
    AuthResponse,
    ChangePasswordPayload,
    EmailCheckResult,
    PasswordInfo,
    SignInCredentials,
    SignUpDetails,
    User
} from '../../domain/entities/auth';

export default class AuthRepository extends BaseRepository implements IAuthRepository{
    constructor(){
        super('/auth');
    }

    async getMe(): Promise<User>{
        const response = await this.client.get<ApiResponse<User>>('/me');
        return this.unwrap(response);
    }

    async signIn(data: SignInCredentials): Promise<AuthResponse>{
        const response = await this.client.post<ApiResponse<AuthResponse>>('/sign-in', data);
        return this.unwrap(response);
    }

    async signUp(data: SignUpDetails): Promise<AuthResponse>{
        const response = await this.client.post<ApiResponse<AuthResponse>>('/sign-up', data);
        return this.unwrap(response);
    }

    async checkEmail(email: string): Promise<EmailCheckResult>{
        const response = await this.client.post<ApiResponse<EmailCheckResult>>('/check-email', { email });
        return this.unwrap(response);
    }

    async getGuestIdentity(seed: string): Promise<User>{
        const response = await this.client.get<ApiResponse<User>>('/guest-identity', { seed });
        return this.unwrap(response);
    }

    async updateMe(data: Partial<User> | FormData): Promise<User>{
        const isFormData = data instanceof FormData;
        const response = await this.client.request<ApiResponse<User>>('PATCH', '/me', {
            body: data,
            headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined
        });
        return this.unwrap(response);
    }

    async getPasswordInfo(): Promise<PasswordInfo>{
        const response = await this.client.get<ApiResponse<PasswordInfo>>('/password/info');
        return this.unwrap(response);
    }

    async changePassword(data: ChangePasswordPayload): Promise<void>{
        await this.client.patch<ApiResponse<void>>('/me/update/password/', data);
    }
};