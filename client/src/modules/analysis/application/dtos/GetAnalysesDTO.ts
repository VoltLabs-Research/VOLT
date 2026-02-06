import type { Analysis } from '../../domain/entities';
import type { PaginatedResponse } from '@/shared/domain/pagination';

export interface GetAnalysesInputDTO {
    page: number;
    limit: number;
    search?: string;
};

export type GetAnalysesOutputDTO = PaginatedResponse<Analysis>;
