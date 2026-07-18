import type { PersistedUserDTO } from '@modules/auth/dtos/PersistedUserDTO';
import type { UpdatePasswordInput } from '@volt/contracts/modules/auth/http';

export interface UpdatePasswordInputDTO extends UpdatePasswordInput{
    userId: string;
    userAgent: string;
    ip: string;
}

export interface UpdatePasswordOutputDTO{
    token: string;
    user: PersistedUserDTO;
}
