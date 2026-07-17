import type { PersistedUserDTO } from '@modules/auth/application/dtos/PersistedUserDTO';
import type { SignInInput } from '@volt/contracts/modules/auth/http';

// Wire body (email/password) lives once in @volt/contracts; the use case
// augments it with request-derived context.
export interface SignInInputDTO extends SignInInput{
    ip: string;
    userAgent: string;
}

export interface SignInOutputDTO{
    token: string;
    user: PersistedUserDTO;
}
