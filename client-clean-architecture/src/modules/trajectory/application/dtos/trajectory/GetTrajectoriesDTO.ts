import type { Trajectory } from '../../../domain/entities';
import type { ListingMeta } from '@/shared/domain/entities/ListingMeta';

interface GetTrajectoriesInputDTO {
    page?: number;
    limit?: number;
    search?: string;
};

interface GetTrajectoriesOutputDTO {
    trajectories: Trajectory[];
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
};

export type { GetTrajectoriesInputDTO, GetTrajectoriesOutputDTO, ListingMeta };
