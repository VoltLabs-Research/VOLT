import { toScriptingNotebookDTO } from '@modules/scripting/application/utilities/to-scripting-notebook-dto';
import {
    ListScriptingNotebooksInputDTO,
    ListScriptingNotebooksOutputDTO
} from '@modules/scripting/application/dtos/ListScriptingNotebooksDTO';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';

@injectable()
export class ListScriptingNotebooksUseCase implements IUseCase<ListScriptingNotebooksInputDTO, ListScriptingNotebooksOutputDTO, ApplicationError> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository)
        private readonly scriptingNotebookRepository: IScriptingNotebookRepository
    ) {}

    async execute(input: ListScriptingNotebooksInputDTO): Promise<Result<ListScriptingNotebooksOutputDTO, ApplicationError>> {
        const page = Math.max(1, Number(input.page || 1));
        const limit = Math.max(1, Math.min(500, Number(input.limit || 500)));
        const result = await this.scriptingNotebookRepository.findAllByTeam(
            input.teamId,
            { page, limit },
            {
                trajectoryId: input.trajectoryId,
                scope: input.scope
            }
        );

        return Result.ok({
            ...result,
            data: result.data.map(toScriptingNotebookDTO)
        });
    }
};
