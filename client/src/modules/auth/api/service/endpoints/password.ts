import { get, patch } from '@/app/core/http/utilities/create-service';
import type { GetPasswordInfoOutputDTO } from '../../dtos/password-info';
import type { ChangePasswordInputDTO, ChangePasswordOutputDTO } from '../../dtos/change-password';
import type { EmptyParams } from '@/app/core/http/utilities/create-service';

const endpoints = {
    getPasswordInfo: get<EmptyParams, GetPasswordInfoOutputDTO>('/password/info'),
    changePassword: patch<ChangePasswordInputDTO, ChangePasswordOutputDTO>('/me/password')
};

export default endpoints;
