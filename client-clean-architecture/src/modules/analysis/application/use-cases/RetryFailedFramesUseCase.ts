import type { IAnalysisRepository } from '../../domain/repositories/IAnalysisRepository';
import type { RetryFailedFramesResponse } from '../../domain/entities';

export class RetryFailedFramesUseCase {
    constructor(private readonly analysisRepository: IAnalysisRepository) {}

    async execute(id: string): Promise<RetryFailedFramesResponse> {
        return this.analysisRepository.retryFailedFrames(id);
    }
}
