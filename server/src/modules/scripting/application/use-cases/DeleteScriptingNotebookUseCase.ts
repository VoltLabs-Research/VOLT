import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { DeleteScriptingNotebookInputDTO, DeleteScriptingNotebookOutputDTO } from '@modules/scripting/application/dtos/DeleteScriptingNotebookDTO';
import NotebookDeletedEvent from '@modules/scripting/domain/events/NotebookDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject } from 'tsyringe';

@Singleton()
export class DeleteScriptingNotebookUseCase implements IUseCase<DeleteScriptingNotebookInputDTO, DeleteScriptingNotebookOutputDTO, ApplicationError> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository) private readonly scriptingNotebookRepository: IScriptingNotebookRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient) private readonly teamClusterDaemonClient: ITeamClusterDaemonClient
    ) {}

    async execute(input: DeleteScriptingNotebookInputDTO): Promise<Result<DeleteScriptingNotebookOutputDTO, ApplicationError>> {
        try {
            const notebook = await this.scriptingNotebookRepository.findById(input.notebookId);
            if (!notebook) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'Notebook not found'
                ));
            }

            if (notebook.props.teamCluster && notebook.props.runtimeNotebookId) {
                try {
                    await this.teamClusterDaemonClient.command<{ deleted: boolean; }>(
                        notebook.props.teamCluster,
                        ChannelCommands.NotebookDelete,
                        {
                            notebookId: notebook.props.runtimeNotebookId
                        }
                    );
                } catch {
                }
            }

            await this.scriptingNotebookRepository.deleteById(input.notebookId);

            await this.eventBus.publish(new NotebookDeletedEvent({
                notebookId: input.notebookId,
                teamId: input.teamId
            }));

            return Result.ok(null);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to delete notebook',
                500
            ));
        }
    }
}
