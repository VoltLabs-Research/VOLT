import { post } from '@/app/core/http/utilities/create-service';
import type { RetryFailedFramesResponse } from '../../dtos/retry-failed-frames';

const endpoints = {
    retryFailedFrames: post<{ analysisId: string }, RetryFailedFramesResponse>('/:analysisId/failed-frames/retries')
};

export default endpoints;
