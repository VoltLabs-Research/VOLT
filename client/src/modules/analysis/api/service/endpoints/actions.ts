import { post } from '@/app/core/http/utilities/create-service';
import type { RetryFailedFramesResponse } from '../../dtos/retry-failed-frames';

const endpoints = {
    retryFailedFrames: post<{ _id: string }, RetryFailedFramesResponse>('/:_id/retry-failed-frames')
};

export default endpoints;
