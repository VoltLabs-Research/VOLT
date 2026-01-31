import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type IAnalysisRepository from '../../domain/ports/IAnalysisRepository';
import type { GetAnalysesByTrajectoryInputDTO, GetAnalysesByTrajectoryOutputDTO } from '../dtos';
import { ANALYSIS_TOKENS } from '../../infrastructure/di/tokens';

@injectable()
export default class GetAnalysesByTrajectoryUseCase implements IUseCase<GetAnalysesByTrajectoryInputDTO, GetAnalysesByTrajectoryOutputDTO> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository
    ){}

    async execute(params: GetAnalysesByTrajectoryInputDTO): Promise<GetAnalysesByTrajectoryOutputDTO> {
        return this.analysisRepository.getByTrajectoryId(params);
    }
};
