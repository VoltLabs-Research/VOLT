import { createService, del, get, patch, post, request } from '@/app/core/http/utilities/create-service';
import { buildFileFormData } from '@/shared/utils/file';
import type { EmptyParams } from '@voltstack/voltclient';
import type { User } from './entities/user';

export interface ChangePasswordInputDTO {
    passwordCurrent?: string;
    password: string;
}

export interface ChangePasswordOutputDTO {
    token: string;
    user: User;
}

export interface CheckEmailInputDTO {
    email: string;
}

export interface CheckEmailOutputDTO {
    exists: boolean;
}

export type OAuthProviderKey = 'github' | 'google' | 'microsoft';

export interface GetAvailableOAuthProvidersOutputDTO {
    providers: OAuthProviderKey[];
}

export interface GetPasswordInfoOutputDTO {
    hasPassword: boolean;
    lastChanged?: string;
}

export interface SignInInputDTO {
    email: string;
    password: string;
}

export interface SignInOutputDTO {
    user: User;
    token: string;
}

export interface SignUpInputDTO {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    passwordConfirm: string;
}

export interface SignUpOutputDTO {
    user: User;
    token: string;
}

export interface UpdateAvatarInputDTO {
    avatar: File;
}

export interface UpdateProfileInputDTO {
    fullName: string;
    email: string;
}

type UpdateMeInput = UpdateProfileInputDTO | UpdateAvatarInputDTO;

const isUpdateAvatarInputDTO = (data: UpdateMeInput): data is UpdateAvatarInputDTO => (
    'avatar' in data && data.avatar instanceof File
);

const buildUpdateMeBody = (data: UpdateMeInput): UpdateProfileInputDTO | FormData => {
    if (!isUpdateAvatarInputDTO(data)) {
        return data;
    }
    return buildFileFormData([{ name: 'avatar', file: data.avatar }]);
};

const buildUpdateMeHeaders = (data: UpdateMeInput) => {
    if (isUpdateAvatarInputDTO(data)) {
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
    signIn: post<SignInInputDTO, SignInOutputDTO>('/sessions'),
    signUp: post<SignUpInputDTO, SignUpOutputDTO>('/users', {
        omit: ['passwordConfirm']
    }),
    checkEmail: get<CheckEmailInputDTO, CheckEmailOutputDTO>('/emails/:email/availability'),
    getAvailableOAuthProviders: get<EmptyParams, GetAvailableOAuthProvidersOutputDTO>('/oauth/providers'),
    getPasswordInfo: get<EmptyParams, GetPasswordInfoOutputDTO>('/password/info'),
    changePassword: patch<ChangePasswordInputDTO, ChangePasswordOutputDTO>('/me/password')
};

export default createService({
    clients: {
        default: {
            basePath: '/auth'
        }
    }
}, endpoints);
