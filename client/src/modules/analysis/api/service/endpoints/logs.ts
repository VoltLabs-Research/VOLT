import { get } from '@/app/core/http/utilities/create-service';
import type {
    GetAnalysisFrameLogParams,
    GetAnalysisFrameLogResponse
} from '../../dtos/get-analysis-frame-log';

const endpoints = {
    getFrameLog: get<GetAnalysisFrameLogParams, GetAnalysisFrameLogResponse>('/:analysisId/logs/:timestep')
};

export default endpoints;
