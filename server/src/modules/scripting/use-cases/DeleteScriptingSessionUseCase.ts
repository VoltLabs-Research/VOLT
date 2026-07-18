import { SCRIPTING_TOKENS } from '@modules/scripting/di/ScriptingTokens';
import type { IScriptingNotebookRepository } from '@modules/scripting/ports/IScriptingNotebookRepository';
import { inject } from 'tsyringe';
import { ErrorCodes } from '@core/constants/error-codes';
import type {
    DeleteScriptingSessionInputDTO,
    DeleteScriptingSessionOutputDTO
} from '@modules/scripting/dtos/ScriptingSessionDTO';
import type { INotebookRuntimeTerminator } from '@modules/scripting/ports/INotebookRuntimeTerminator';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class DeleteScriptingSessionUseCase implements IUseCase<DeleteScriptingSessionInputDTO, DeleteScriptingSessionOutputDTO> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository) private readonly scriptingNotebookRepository: IScriptingNotebookRepository,
        @inject(SCRIPTING_TOKENS.NotebookRuntimeTerminator) private readonly notebookRuntimeTerminator: INotebookRuntimeTerminator
    ) {}

    async execute(input: DeleteScriptingSessionInputDTO): Promise<DeleteScriptingSessionOutputDTO> {
        const notebook = await this.scriptingNotebookRepository.findByTeamAndNotebookId(input.teamId, input.notebookId);

        if (!notebook) {
            throw ApplicationError.notFound(
                ErrorCodes.SCRIPTING_NOTEBOOK_NOT_FOUND,
                'Notebook not found'
            );
        }

        const runtimeNotebookId = notebook.props.runtimeNotebookId;
        const teamClusterId = notebook.props.teamCluster;

        if (runtimeNotebookId && teamClusterId) {
            await this.notebookRuntimeTerminator.terminate(teamClusterId, runtimeNotebookId);
        }

        await this.scriptingNotebookRepository.updateById(notebook._id, {
            runtimeNotebookId: undefined
        });

        return {
            notebookId: notebook._id,
            deleted: Boolean(runtimeNotebookId),
            runtimeNotebookId: runtimeNotebookId || undefined
        };
    }
}
