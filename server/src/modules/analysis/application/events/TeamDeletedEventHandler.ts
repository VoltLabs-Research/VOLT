import { injectable, inject } from 'tsyringe';
import { DeleteManyOnTeamDeletedHandler } from '@shared/application/events/DeleteManyOnTeamDeletedHandler';
import { ANALYSIS_TOKENS } from '@modules/analysis/application/di/AnalysisTokens';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';

@injectable()
export default class TeamDeletedEventHandler extends DeleteManyOnTeamDeletedHandler {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        protected readonly repository: IAnalysisRepository
    ) {
        super();
    }
};
