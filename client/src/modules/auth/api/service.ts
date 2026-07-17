import { createService, del, get, patch, post, request } from '@/app/core/http/utilities/create-service';
import { buildFileFormData } from '@/shared/utils/file';
import type { EmptyParams } from '@voltstack/voltclient';
import type { User } from './types/user';

export interface ChangePasswordInput {
    passwordCurrent?: string;
    password: string;
}

export interface ChangePasswordResponse {
    token: string;
    user: User;
}

export interface CheckEmailInput {
    email: string;
}

export interface CheckEmailResponse {
    exists: boolean;
}

export type OAuthProviderKey = 'github' | 'google' | 'microsoft';

export interface GetAvailableOAuthProvidersResponse {
    providers: OAuthProviderKey[];
}

export interface GetPasswordInfoResponse {
    hasPassword: boolean;
    lastChanged?: string;
}

export interface SignInInput {
    email: string;
    password: string;
}

export interface SignInResponse {
    user: User;
    token: string;
}

export interface SignUpInput {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    passwordConfirm: string;
}

export interface SignUpResponse {
    user: User;
    token: string;
}

export interface UpdateAvatarInput {
    avatar: File;
}

export interface UpdateProfileInput {
    fullName: string;
    email: string;
}

type UpdateMeInput = UpdateProfileInput | UpdateAvatarInput;

const isUpdateAvatarInput = (data: UpdateMeInput): data is UpdateAvatarInput => (
    'avatar' in data && data.avatar instanceof File
);

const buildUpdateMeBody = (data: UpdateMeInput): UpdateProfileInput | FormData => {
    if (!isUpdateAvatarInput(data)) {
        return data;
    }
    return buildFileFormData([{ name: 'avatar', file: data.avatar }]);
};

const buildUpdateMeHeaders = (data: UpdateMeInput) => {
    if (isUpdateAvatarInput(data)) {
        return { 'Content-Type': 'multipart/form-data' };
    }
    return undefined;
};

const endpoints = {
    getMe: get<EmptyParams, User>('/me'),
    updateMe: request<UpdateMeInput, User>('PATCH', '/me', {
        body: buildUpdateMeBody,
        headers: buildUpdateMeHeaders
    }),
    deleteMe: del<EmptyParams>('/me'),
    signIn: post<SignInInput, SignInResponse>('/sessions'),
    localSignIn: post<EmptyParams, SignInResponse>('/sessions/local'),
    signUp: post<SignUpInput, SignUpResponse>('/users', {
        omit: ['passwordConfirm']
    }),
    checkEmail: get<CheckEmailInput, CheckEmailResponse>('/emails/:email/availability'),
    getAvailableOAuthProviders: get<EmptyParams, GetAvailableOAuthProvidersResponse>('/oauth/providers'),
    getPasswordInfo: get<EmptyParams, GetPasswordInfoResponse>('/password/info'),
    changePassword: patch<ChangePasswordInput, ChangePasswordResponse>('/me/password')
};

export default createService({
    clients: {
        default: {
            basePath: '/auth'
        }
    }
}, endpoints);
