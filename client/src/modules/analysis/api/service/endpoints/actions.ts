import { post } from '@/app/core/http/utilities/create-service';
import type { RetryFailedFramesParams, RetryFailedFramesResponse } from '../../dtos/retry-failed-frames';

const endpoints = {
    retryFailedFrames: post<RetryFailedFramesParams, RetryFailedFramesResponse>('/:analysisId/failed-frames/retries')
};

export default endpoints;
