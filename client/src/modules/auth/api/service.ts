import { isUpdateAvatarInputDTO } from './dtos/update-avatar';
import { defineServiceModule } from '@/shared/api/service-module';
import { del, get, patch, post, request } from '@/app/core/http/utilities/create-service';
import type { ChangePasswordInputDTO, ChangePasswordOutputDTO } from './dtos/change-password';
import type { CheckEmailInputDTO, CheckEmailOutputDTO } from './dtos/check-email';
import type { EmptyParams } from '@/app/core/http/utilities/create-service';
import type { GetAvailableOAuthProvidersOutputDTO } from './dtos/oauth-providers';
import type { GetPasswordInfoOutputDTO } from './dtos/password-info';
import type { SignInInputDTO, SignInOutputDTO } from './dtos/sign-in';
import type { SignUpInputDTO, SignUpOutputDTO } from './dtos/sign-up';
import type { UpdateAvatarInputDTO } from './dtos/update-avatar';
import type { UpdateProfileInputDTO } from './dtos/update-profile';
import type { User } from './entities/user';

type UpdateMeInput = UpdateProfileInputDTO | UpdateAvatarInputDTO;

const buildUpdateMeBody = (data: UpdateMeInput): UpdateProfileInputDTO | FormData => {
    if (!isUpdateAvatarInputDTO(data)) {
        return data;
    }

    const formData = new FormData();
    formData.append('avatar', data.avatar);
    return formData;
};

const buildUpdateMeHeaders = (data: UpdateMeInput) => {
    let headers: Record<string, string> | undefined;

    if (isUpdateAvatarInputDTO(data)) {
        headers = { 'Content-Type': 'multipart/form-data' };
    }

    return headers;
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

export default defineServiceModule({
    clients: {
        default: {
            basePath: '/auth'
        }
    },
    endpoints
});
