import { createService, del, get, patch, post, request } from '@/app/core/http/utils/create-service';
import { buildFileFormData } from '@/shared/utils/file';
import type { EmptyParams } from '@voltstack/voltclient';
import type { SignInInput, SignUpInput, UpdatePasswordInput, UpdateAccountInput } from '@volt/contracts/modules/auth/http';
import type {
    AuthSession,
    CheckEmailResponse,
    OAuthProviders,
    PasswordInfo,
    User
} from '@volt/contracts/modules/auth/domain';
import type {
    CheckEmailParams,
    UpdateAvatarInput,
    UpdateMeInput
} from '../contracts/forms';

const isUpdateAvatarInput = (data: UpdateMeInput): data is UpdateAvatarInput => (
    'avatar' in data && data.avatar instanceof File
);

const buildUpdateMeBody = (data: UpdateMeInput): UpdateAccountInput | FormData => {
    if (!isUpdateAvatarInput(data)) {
        return data;
    }
    return buildFileFormData([{
        name: 'avatar',
        file: data.avatar
    }]);
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
    signIn: post<SignInInput, AuthSession>('/sessions'),
    localSignIn: post<EmptyParams, AuthSession>('/sessions/local'),
    signUp: post<SignUpInput, AuthSession>('/users'),
    checkEmail: get<CheckEmailParams, CheckEmailResponse>('/emails/:email/availability'),
    getAvailableOAuthProviders: get<EmptyParams, OAuthProviders>('/oauth/providers'),
    getPasswordInfo: get<EmptyParams, PasswordInfo>('/password/info'),
    changePassword: patch<UpdatePasswordInput, AuthSession>('/me/password')
};

export default createService({
    clients: {
        default: {
            basePath: '/auth'
        }
    }
}, endpoints);
