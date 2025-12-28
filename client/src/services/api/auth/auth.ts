import VoltClient from '@/api';
import type { ApiResponse } from '@/types/api';
import type { SignInCredentials, AuthResponse, User, PasswordInfo, ChangePasswordPayload, SignUpDetails } from './types';

const client = new VoltClient('/auth');

export default {
    async getMe(): Promise<User>{
        const response = await client.request<ApiResponse<User>>('get', '/me');
        return response.data.data;
    },

    async signIn(data: SignInCredentials): Promise<AuthResponse>{
        const response = await client.request<ApiResponse<AuthResponse>>('post', '/sign-in', { data });
        return response.data.data;
    },

    async signUp(data: SignUpDetails): Promise<AuthResponse>{
        const response = await client.request<ApiResponse<AuthResponse>>('post', '/sign-up', { data });
        return response.data.data;
    },

    async checkEmail(email: string): Promise<{ exists: boolean; hasPassword: boolean }> {
        const response = await client.request<{ data: { exists: boolean; hasPassword: boolean } }>('post', '/check-email', { data: { email } });
        return response.data.data;
    },

    async getGuestIdentity(seed: string): Promise<User>{
        const response = await client.request<ApiResponse<User>>('get', `/guest-identity?seed=${seed}`);
        return response.data.data;
    },

    async updateMe(data: Partial<User> | FormData): Promise<User>{
        const isFormData = data instanceof FormData;
        const response = await client.request<ApiResponse<User>>('patch', '/me', {
            data,
            config: {
                headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined
            }
        });
        return response.data.data;
    },

    password: {
        async getInfo(): Promise<PasswordInfo>{
            const response = await client.request<{ data: PasswordInfo }>('get', '/password/info');
            return response.data.data;
        },

        async change(data: ChangePasswordPayload): Promise<void>{
            await client.request('patch', '/password/change', { data });
        }
    }
};
