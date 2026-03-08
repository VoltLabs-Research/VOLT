import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { SSHConnection } from '../entities/ssh-connection';

export interface GetSSHConnectionsInputDTO {
    page?: number;
    limit?: number;
};

export type GetSSHConnectionsOutputDTO = PaginatedResponse<SSHConnection>;
