import { User } from '../../domain/entities/User';

export interface GetGuestIdentityInputDTO{
    seed: string;
};

export type GetGuestIdentityOutputDTO = User;