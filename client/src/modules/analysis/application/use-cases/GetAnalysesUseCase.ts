import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type IAnalysisRepository from '../../domain/ports/IAnalysisRepository';
import type { GetAnalysesInputDTO, GetAnalysesOutputDTO } from '../dtos';
import { ANALYSIS_TOKENS } from '../../infrastructure/di/tokens';

@injectable()
export default class GetAnalysesUseCase implements IUseCase<GetAnalysesInputDTO, GetAnalysesOutputDTO> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository
    ){}

    async execute(params: GetAnalysesInputDTO): Promise<GetAnalysesOutputDTO> {
        return this.analysisRepository.getAll(params);
    }
};
