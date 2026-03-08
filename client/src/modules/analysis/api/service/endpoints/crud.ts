import { paginated, del } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { Analysis } from '../../entities/analysis';
import type { GetAnalysesParams } from '../../dtos/get-analyses';
import type { GetAnalysesByTrajectoryParams } from '../../dtos/get-analyses-by-trajectory';

const endpoints = {
    getAll: paginated<GetAnalysesParams, PaginatedResponse<Analysis>>('/'),
    getByTrajectoryId: paginated<GetAnalysesByTrajectoryParams, PaginatedResponse<Analysis>>(
        '/trajectory/:trajectoryId'
    ),
    delete: del<{ analysisId: string }>('/:analysisId')
};

export default endpoints;
