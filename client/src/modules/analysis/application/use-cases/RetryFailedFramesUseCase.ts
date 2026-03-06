import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type IAnalysisRepository from '../../domain/port/IAnalysisRepository';
import type { RetryFailedFramesInputDTO, RetryFailedFramesOutputDTO } from '../dtos';
import { ANALYSIS_TOKENS } from '../../infrastructure/di/tokens';

@injectable()
export default class RetryFailedFramesUseCase implements IUseCase<RetryFailedFramesInputDTO, RetryFailedFramesOutputDTO> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository
    ){}

    async execute({ id }: RetryFailedFramesInputDTO): Promise<RetryFailedFramesOutputDTO> {
        return this.analysisRepository.retryFailedFrames(id);
    }
};
