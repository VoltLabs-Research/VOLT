import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { DeleteManyOnTrajectoryDeletedHandler } from '@shared/application/events/DeleteManyOnTrajectoryDeletedHandler';
import { inject, injectable } from 'tsyringe';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';

@injectable()
export default class TrajectoryDeletedEventHandler extends DeleteManyOnTrajectoryDeletedHandler {
    protected readonly repository: IAnalysisRepository;

    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        analysisRepository: IAnalysisRepository
    ) {
        super();
        this.repository = analysisRepository;
    }
};
