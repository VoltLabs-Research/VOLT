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
            input.trajectoryId
        );

        const value: ListScriptingNotebooksOutputDTO = {
            ...result,
            data: result.data.map((notebook) => {
                let trajectories: string[] = [];

                if (Array.isArray(notebook.props.trajectories)) {
                    trajectories = notebook.props.trajectories.map(String);
                }

                return {
                    _id: notebook._id,
                    teamCluster: notebook.props.teamCluster,
                    title: notebook.props.title,
                    notebookPath: notebook.props.notebookPath,
                    trajectories,
                    lastOpenedAt: notebook.props.lastOpenedAt,
                    createdAt: notebook.props.createdAt,
                    updatedAt: notebook.props.updatedAt
                };
            })
        };

        return Result.ok(value);
    }
};
