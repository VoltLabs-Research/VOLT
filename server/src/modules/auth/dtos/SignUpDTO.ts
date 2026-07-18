import type { PersistedUserDTO } from '@modules/auth/dtos/PersistedUserDTO';
import type { SignUpInput } from '@volt/contracts/modules/auth/http';

export interface SignUpInputDTO extends SignUpInput{
    ip: string;
    userAgent: string;
}

export interface SignUpOutputDTO{
    token: string;
    user: PersistedUserDTO
}
