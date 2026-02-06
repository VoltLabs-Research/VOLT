import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type IAnalysisRepository from '../../domain/ports/IAnalysisRepository';
import type { DeleteAnalysisInputDTO } from '../dtos';
import { ANALYSIS_TOKENS } from '../../infrastructure/di/tokens';

@injectable()
export default class DeleteAnalysisUseCase implements IUseCase<DeleteAnalysisInputDTO, void> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository
    ){}

    async execute({ id }: DeleteAnalysisInputDTO): Promise<void> {
        await this.analysisRepository.delete(id);
    }
};
