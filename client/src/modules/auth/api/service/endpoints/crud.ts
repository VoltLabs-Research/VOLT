import { get, del, request, type EmptyParams } from '@/app/core/http/utilities/create-service';
import type { User } from '../../entities/user';
import type { UpdateProfileInputDTO } from '../../dtos/update-profile';
import { type UpdateAvatarInputDTO, isUpdateAvatarInputDTO } from '../../dtos/update-avatar';

type UpdateMeInput = UpdateProfileInputDTO | UpdateAvatarInputDTO;

const buildUpdateMeBody = (data: UpdateMeInput): UpdateProfileInputDTO | FormData => {
    if (!isUpdateAvatarInputDTO(data)) {
        return data;
    }

    const formData = new FormData();
    formData.append('avatar', data.avatar);
    return formData;
};

const endpoints = {
    getMe: get<EmptyParams, User>('/me'),
    updateMe: request<UpdateMeInput, User>('PATCH', '/me', {
        body: buildUpdateMeBody,
        headers: (data) => isUpdateAvatarInputDTO(data)
            ? { 'Content-Type': 'multipart/form-data' }
            : undefined
    }),
    deleteMe: del<EmptyParams>('/me')
};

export default endpoints;
