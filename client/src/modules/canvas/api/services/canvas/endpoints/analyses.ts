import { get } from '@/app/core/http/utilities/create-service';
import type {
    GetAnalysisFrameLogParams,
    GetAnalysisFrameLogResponse
} from '@/modules/analysis/api/dtos/get-analysis-frame-log';

interface PublicCanvasFrameLogParams extends GetAnalysisFrameLogParams {
    trajectoryId: string;
};

export default {
    getFrameLog: get<PublicCanvasFrameLogParams, GetAnalysisFrameLogResponse>(
        '/:trajectoryId/analyses/:analysisId/logs/:timestep',
        {
            omit: ['trajectoryId', 'analysisId', 'timestep'],
            query: ({ afterCursor }) => afterCursor === undefined ? undefined : { afterCursor }
        }
    )
};
