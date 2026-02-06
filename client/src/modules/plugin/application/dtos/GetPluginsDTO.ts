import type { Plugin } from '../../domain/entities';
import type { PaginatedResponse } from '@/shared/domain/pagination';

export interface GetPluginsInputDTO {
    page: number;
    limit: number;
    search?: string;
    status?: string;
};

export type GetPluginsOutputDTO = PaginatedResponse<Plugin>;
