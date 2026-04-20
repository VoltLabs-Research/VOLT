import { download, get, paginated } from '@/app/core/http/utilities/create-service';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';
import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type {
    GetPublicCanvasBootstrapInput,
    GetPublicCanvasBootstrapOutput
} from '@/modules/canvas/api/dtos/bootstrap';
import atoms from './atoms';
import simulationCell from './simulation-cell';
import sceneArtifacts from './scene-artifacts';
import colorCoding from './color-coding';
import particleFilter from './particle-filter';
import plugins from './plugins';
import analyses from './analyses';
import rasters from './rasters';

interface GetCanvasTrajectoryParams {
    trajectoryId: string;
};

interface ListCanvasAnalysesParams {
    trajectoryId: string;
    page?: number;
    limit?: number;
};

interface GetCanvasRasterFrameParams {
    trajectoryId: string;
    timestep: number;
};

interface GetCanvasAnalysisRasterFrameParams extends GetCanvasRasterFrameParams {
    analysisId: string;
    model: string;
};

interface GetCanvasDumpParams {
    trajectoryId: string;
    timestep: number | string;
};

export default {
    getBootstrap: get<GetPublicCanvasBootstrapInput, GetPublicCanvasBootstrapOutput>('/:trajectoryId/bootstrap'),
    getTrajectory: get<GetCanvasTrajectoryParams, Trajectory>('/:trajectoryId'),
    listAnalyses: paginated<ListCanvasAnalysesParams, PaginatedResponse<Analysis>>('/:trajectoryId/analyses', {
        omit: ['trajectoryId'],
        query: ({ page, limit }) => ({
            ...(page !== undefined ? { page } : {}),
            ...(limit !== undefined ? { limit } : {})
        })
    }),
    getRasterFrame: download<GetCanvasRasterFrameParams>('GET', '/:trajectoryId/frames/:timestep'),
    getAnalysisRasterFrame: download<GetCanvasAnalysisRasterFrameParams>('GET', '/:trajectoryId/frames/:timestep/:analysisId/:model'),
    getDump: download<GetCanvasDumpParams>('GET', '/:trajectoryId/dumps/:timestep'),
    ...atoms,
    ...simulationCell,
    ...sceneArtifacts,
    ...colorCoding,
    ...particleFilter,
    ...plugins,
    ...analyses,
    ...rasters
};
