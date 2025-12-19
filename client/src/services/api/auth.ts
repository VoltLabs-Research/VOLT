import api from '@/api';
import type { ApiResponse } from '@/types/api';

interface User {
    _id: string;
    username: string;
    email: string;
    [key: string]: any;
}

interface AuthResponse {
    user: User;
    token: string;
}

interface SignInCredentials {
    email: string;
    password: string;
}

interface SignUpDetails {
    username: string;
    email: string;
    password: string;
}

interface PasswordInfo {
    hasPassword: boolean;
    lastChanged?: string;
}

interface ChangePasswordPayload {
    currentPassword?: string;
    newPassword: string;
}

const authApi = {
    async getMe(): Promise<User>{
        const response = await api.get<ApiResponse<User>>('/auth/me');
        return response.data.data;
    },

    async signIn(credentials: SignInCredentials): Promise<AuthResponse>{
        const response = await api.post<ApiResponse<AuthResponse>>('/auth/sign-in', credentials);
        return response.data.data;
    },

    async signUp(details: SignUpDetails): Promise<AuthResponse>{
        const response = await api.post<ApiResponse<AuthResponse>>('/auth/sign-up', details);
        return response.data.data;
    },

    async checkEmail(email: string): Promise<{ exists: boolean; hasPassword: boolean }> {
        const response = await api.post<{ data: { exists: boolean; hasPassword: boolean } }>('/auth/check-email', { email });
        return response.data.data;
    },

    async getGuestIdentity(seed: string): Promise<User>{
        const response = await api.get<ApiResponse<User>>(`/auth/guest-identity?seed=${seed}`);
        return response.data.data;
    },

    async updateMe(data: Partial<User> | FormData): Promise<User>{
        const isFormData = data instanceof FormData;
        const response = await api.patch<ApiResponse<User>>('/auth/me', data, {
            headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined
        });
        return response.data.data;
    },

    password: {
        async getInfo(): Promise<PasswordInfo>{
            const response = await api.get<{ data: PasswordInfo }>('/auth/password/info');
            return response.data.data;
        },

        async change(payload: ChangePasswordPayload): Promise<void>{
            await api.put('/auth/password/change', payload);
        }
    }
};

export default authApi;
