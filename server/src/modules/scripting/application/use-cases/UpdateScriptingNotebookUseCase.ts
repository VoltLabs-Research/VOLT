import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';
import { inject } from 'tsyringe';
import { ErrorCodes } from '@core/constants/error-codes';
import type { ITeamClusterSelectionService } from '@modules/container/domain/port/ITeamClusterSelectionService';
import type { ScriptingNotebookDTO } from '@modules/scripting/application/dtos/ScriptingNotebookDTO';
import type { UpdateScriptingNotebookInputDTO } from '@modules/scripting/application/dtos/UpdateScriptingNotebookDTO';
import { toScriptingNotebookDTO } from '@modules/scripting/application/utilities/to-scripting-notebook-dto';
import type { ScriptingNotebookProps } from '@modules/scripting/domain/entities/ScriptingNotebook';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class UpdateScriptingNotebookUseCase implements IUseCase<UpdateScriptingNotebookInputDTO, ScriptingNotebookDTO, ApplicationError> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository) private readonly scriptingNotebookRepository: IScriptingNotebookRepository,
        @inject(CONTAINER_TOKENS.TeamClusterSelectionService) private readonly teamClusterSelectionService: ITeamClusterSelectionService,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient) private readonly teamClusterDaemonClient: ITeamClusterDaemonClient
    ) {}

    async execute(input: UpdateScriptingNotebookInputDTO): Promise<Result<ScriptingNotebookDTO, ApplicationError>> {
        try {
            const existing = await this.scriptingNotebookRepository.findByTeamAndNotebookId(
                input.teamId,
                input.notebookId
            );

            if (!existing) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'Notebook not found'
                ));
            }

            const updateData: Partial<ScriptingNotebookProps> = {
                updatedAt: new Date()
            };
            let resetRuntime = false;

            if (typeof input.title === 'string') {
                const title = input.title.trim();
                if (!title) {
                    return Result.fail(ApplicationError.badRequest(
                        ErrorCodes.VALIDATION_INVALID_INPUT,
                        'Notebook title is required'
                    ));
                }

                updateData.title = title;
            }

            if (input.teamClusterId) {
                const resolvedTeamClusterId = await this.teamClusterSelectionService.resolveConnectedClusterId(
                    input.teamId,
                    input.teamClusterId
                );
                if (existing.props.teamCluster !== resolvedTeamClusterId) {
                    updateData.teamCluster = resolvedTeamClusterId;
                    resetRuntime = true;
                }
            }

            if (input.containerResources) {
                const nextContainerResources = {
                    cpus: input.containerResources.cpus,
                    memoryMB: input.containerResources.memoryMB
                };
                if (
                    existing.props.containerResources?.cpus !== nextContainerResources.cpus
                    || existing.props.containerResources?.memoryMB !== nextContainerResources.memoryMB
                ) {
                    updateData.containerResources = nextContainerResources;
                    resetRuntime = true;
                }
            }

            if (
                updateData.title === undefined
                && updateData.teamCluster === undefined
                && updateData.containerResources === undefined
            ) {
                return Result.fail(ApplicationError.badRequest(
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    'At least one notebook field must be updated'
                ));
            }

            if (resetRuntime) {
                const teamClusterId = existing.props.teamCluster;
                const runtimeNotebookId = existing.props.runtimeNotebookId;

                if (teamClusterId && runtimeNotebookId) {
                    try {
                        await this.teamClusterDaemonClient.command(
                            teamClusterId,
                            ChannelCommands.NotebookDelete,
                            { notebookId: runtimeNotebookId }
                        );
                    } catch {
                    }
                }

                updateData.runtimeNotebookId = undefined;
            }

            const updated = await this.scriptingNotebookRepository.updateById(input.notebookId, updateData);

            if (!updated) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'Notebook not found'
                ));
            }

            return Result.ok(toScriptingNotebookDTO(updated));
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to update notebook',
                500
            ));
        }
    }
}
