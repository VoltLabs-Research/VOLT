import { inject, injectable } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';
import {
    ListScriptingNotebooksInputDTO,
    ListScriptingNotebooksOutputDTO
} from '@modules/scripting/application/dtos/ListScriptingNotebooksDTO';

@injectable()
export class ListScriptingNotebooksUseCase implements IUseCase<ListScriptingNotebooksInputDTO, ListScriptingNotebooksOutputDTO, ApplicationError> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository)
        private readonly scriptingNotebookRepository: IScriptingNotebookRepository
    ) {}

    async execute(input: ListScriptingNotebooksInputDTO): Promise<Result<ListScriptingNotebooksOutputDTO, ApplicationError>> {
        const page = Math.max(1, Number(input.page || 1));
        const limit = Math.max(1, Math.min(500, Number(input.limit || 500)));
        const filter: any = { team: input.teamId };

        if (input.trajectoryId) {
            filter.trajectories = input.trajectoryId;
        }

        const result = await this.scriptingNotebookRepository.findAll({
            filter,
            page,
            limit,
            sort: {
                updatedAt: -1
            }
        });

        const value: ListScriptingNotebooksOutputDTO = {
            ...result,
            data: result.data.map((notebook) => ({
                id: notebook.id,
                title: notebook.props.title,
                notebookPath: notebook.props.notebookPath,
                trajectories: Array.isArray(notebook.props.trajectories)
                    ? notebook.props.trajectories.map((trajectoryId) => String(trajectoryId))
                    : [],
                lastOpenedAt: notebook.props.lastOpenedAt,
                createdAt: notebook.props.createdAt,
                updatedAt: notebook.props.updatedAt
            }))
        };

        return Result.ok(value);
    }
}
