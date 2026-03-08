import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { SecretKey } from '../../entities/secret-key';

export interface GetSecretKeysParams {
    page?: number;
    limit?: number;
    sort?: string;
};

export interface GetSecretKeysInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
    sort?: string;
};

export type GetSecretKeysOutputDTO = PaginatedResponse<SecretKey>;
