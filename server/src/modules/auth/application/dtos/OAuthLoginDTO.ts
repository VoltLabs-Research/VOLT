import type { PersistedUserDTO } from '@modules/auth/application/dtos/PersistedUserDTO';
import { OAuthProvider } from '@modules/auth/domain/entities/User';

export interface OAuthLoginInputDTO{
    email: string;
    firstName?: string;
    lastName?: string;
    oauthProvider: OAuthProvider;
    oauthId: string;
    avatar?: string;
    ip: string;
    userAgent: string;
};

export interface OAuthLoginOutputDTO{
    token: string;
    user: PersistedUserDTO;
};
