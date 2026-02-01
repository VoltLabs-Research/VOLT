import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import IAuthRepository, { CheckEmailResult } from '../../domain/ports/IAuthRepository';
import { User } from '../../domain/entities';
import {
    ChangePasswordInputDTO,
    GetPasswordInfoOutputDTO,
    SignInInputDTO,
    SignInOutputDTO,
    SignUpInputDTO,
    SignUpOutputDTO
} from '../../application/dtos';

@injectable()
export default class AuthRepository extends BaseRepository implements IAuthRepository{
    constructor(){
        super('/auth', { useRBAC: false });
    }

    async getMe(): Promise<User>{
        const response = await this.client.get<ApiResponse<User>>('/me');
        return this.unwrap(response);
    }

    async signIn(data: SignInInputDTO): Promise<SignInOutputDTO>{
        const response = await this.client.post<ApiResponse<SignInOutputDTO>>('/sign-in', data);
        return this.unwrap(response);
    }

    async signUp(data: SignUpInputDTO): Promise<SignUpOutputDTO>{
        const response = await this.client.post<ApiResponse<SignUpOutputDTO>>('/sign-up', data);
        return this.unwrap(response);
    }

    async checkEmail(email: string): Promise<CheckEmailResult>{
        const response = await this.client.post<ApiResponse<CheckEmailResult>>('/check-email', { email });
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

    async getPasswordInfo(): Promise<GetPasswordInfoOutputDTO>{
        const response = await this.client.get<ApiResponse<GetPasswordInfoOutputDTO>>('/password/info');
        return this.unwrap(response);
    }

    async changePassword(data: ChangePasswordInputDTO): Promise<void>{
        await this.client.patch<ApiResponse<void>>('/me/update/password/', data);
    }
};
