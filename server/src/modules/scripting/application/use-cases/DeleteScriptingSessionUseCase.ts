import { ErrorCodes } from '@core/constants/error-codes';
import type {
    DeleteScriptingSessionInputDTO,
    DeleteScriptingSessionOutputDTO
} from '@modules/scripting/application/dtos/ScriptingSessionDTO';
import ScriptingNotebookRepository from '@modules/scripting/infrastructure/persistence/mongo/repositories/ScriptingNotebookRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

@Singleton()
export class DeleteScriptingSessionUseCase implements IUseCase<DeleteScriptingSessionInputDTO, DeleteScriptingSessionOutputDTO, ApplicationError> {
    constructor(
        private readonly scriptingNotebookRepository: ScriptingNotebookRepository,
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    async execute(input: DeleteScriptingSessionInputDTO): Promise<Result<DeleteScriptingSessionOutputDTO, ApplicationError>> {
        const notebook = await this.scriptingNotebookRepository.findByTeamAndNotebookId(input.teamId, input.notebookId);

        if (!notebook) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.SCRIPTING_NOTEBOOK_NOT_FOUND,
                'Notebook not found'
            ));
        }

        const runtimeNotebookId = notebook.props.runtimeNotebookId;
        const teamClusterId = notebook.props.teamCluster;

        if (runtimeNotebookId && teamClusterId) {
            try {
                await this.teamClusterDaemonClient.command(
                    teamClusterId,
                    ChannelCommands.NotebookDelete,
                    { notebookId: runtimeNotebookId }
                );
            } catch {
            }
        }

        await this.scriptingNotebookRepository.updateById(notebook._id, {
            runtimeNotebookId: undefined
        });

        return Result.ok({
            notebookId: notebook._id,
            deleted: Boolean(runtimeNotebookId),
            runtimeNotebookId: runtimeNotebookId || undefined
        });
    }
};
