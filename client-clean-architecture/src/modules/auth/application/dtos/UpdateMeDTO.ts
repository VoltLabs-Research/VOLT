import { User } from '../../domain/entities/User';

export interface UpdateMeInputDTO{
    data: Partial<User> | FormData;
};

export type UpdateMeOutputDTO = User;