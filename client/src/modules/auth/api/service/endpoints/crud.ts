import { isUpdateAvatarInputDTO } from '../../dtos/update-avatar';
import { del, get, request } from '@/app/core/http/utilities/create-service';
import type { UpdateAvatarInputDTO } from '../../dtos/update-avatar';
import type { UpdateProfileInputDTO } from '../../dtos/update-profile';
import type { User } from '../../entities/user';
import type { EmptyParams } from '@/app/core/http/utilities/create-service';

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
    deleteMe: del<EmptyParams>('/me')
};

export default endpoints;
