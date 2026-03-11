import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { DeleteManyOnTeamDeletedHandler } from '@shared/application/events/DeleteManyOnTeamDeletedHandler';
import { inject, injectable } from 'tsyringe';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';

@injectable()
export default class TeamDeletedEventHandler extends DeleteManyOnTeamDeletedHandler {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository)
        protected readonly repository: ILatexDocumentRepository
    ) {
        super();
    }
};
