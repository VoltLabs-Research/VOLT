import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { DeleteManyOnTeamDeletedHandler } from '@shared/application/events/DeleteManyOnTeamDeletedHandler';
import { inject, injectable } from 'tsyringe';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';

@injectable()
export default class TeamDeletedEventHandler extends DeleteManyOnTeamDeletedHandler {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        protected readonly repository: IAnalysisRepository
    ) {
        super();
    }
};
