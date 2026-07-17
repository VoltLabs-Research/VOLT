import { createService, del, get, patch, post, request } from '@/app/core/http/utilities/create-service';
import { buildFileFormData } from '@/shared/utils/file';
import type { EmptyParams } from '@voltstack/voltclient';
import type { User } from './types/user';
// Wire request/response shapes are the single source of truth in @volt/contracts;
// these local names re-export them so a contract change breaks the client at compile time.
import type { SignInInput as SignInInputContract, SignUpInput as SignUpInputContract, UpdatePasswordInput } from '@volt/contracts/modules/auth/http';
import type { CheckEmailResponse as CheckEmailResponseContract, PasswordInfo, OAuthProviders, OAuthProviderId } from '@volt/contracts/modules/auth/domain';

export type ChangePasswordInput = UpdatePasswordInput;

export interface ChangePasswordResponse {
    token: string;
    user: User;
}

export interface CheckEmailInput {
    email: string;
}

export type CheckEmailResponse = CheckEmailResponseContract;

export type OAuthProviderKey = OAuthProviderId;

export type GetAvailableOAuthProvidersResponse = OAuthProviders;

export type GetPasswordInfoResponse = PasswordInfo;

export type SignInInput = SignInInputContract;

export interface SignInResponse {
    user: User;
    token: string;
}

export interface SignUpInput extends SignUpInputContract {
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
