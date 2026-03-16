import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { CreatePluginInputDTO, CreatePluginOutputDTO } from '@modules/plugin/application/dtos/plugin/CreatePluginDTO';
import { mapPluginToPersistedDTO } from '@modules/plugin/utilities/mappers/plugin/mapPluginToPersistedDTO';
import { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import { IWorkflowValidatorService, WorkflowValidationMode } from '@modules/plugin/domain/port/plugin/IWorkflowValidatorService';
import Workflow from '@modules/plugin/domain/entities/plugin/workflow/Workflow';
import PluginCreatedEvent from '@modules/plugin/domain/events/PluginCreatedEvent';
import WorkflowProjectionService from '@modules/plugin/utilities/plugin/WorkflowProjectionService';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';

import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';

import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';

@injectable()
export class CreatePluginUseCase implements IUseCase<CreatePluginInputDTO, CreatePluginOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository,

        @inject(PLUGIN_TOKENS.WorkflowValidatorService)
        private readonly workflowValidator: IWorkflowValidatorService,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus
    ){}

    async execute(input: CreatePluginInputDTO): Promise<Result<CreatePluginOutputDTO>> {
        const validation = await this.workflowValidator.validate(input.workflow, undefined, WorkflowValidationMode.Strict);
        if (!validation.isValid) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_PUBLISH,
                `Plugin workflow is invalid: ${(validation.errors ?? []).join(', ')}`
            ));
        }

        const workflow = new Workflow('', input.workflow);
        const projection = WorkflowProjectionService.project(workflow, '');
        const defaultTeamClusterId = await this.resolveDefaultTeamClusterId(input.teamId);

        const plugin = await this.pluginRepository.create({
            workflow,
            team: input.teamId,
            teamCluster: defaultTeamClusterId,
            status: PluginStatus.Draft,
            modifier: projection.modifier,
            exposures: projection.exposures,
            arguments: projection.arguments,
            listingExposures: projection.listingExposures
        });

        await this.eventBus.publish(new PluginCreatedEvent({
            pluginId: plugin._id,
            teamId: input.teamId
        }));

        return Result.ok({
            plugin: mapPluginToPersistedDTO(plugin)
        });
    }

    private async resolveDefaultTeamClusterId(teamId: string): Promise<string | null> {
        const teamClusters = await this.teamClusterRepository.findAll({
            filter: {
                team: teamId
            },
            page: 1,
            limit: 1,
            sort: {
                createdAt: 1
            }
        });

        return teamClusters.data[0]?.id ?? null;
    }
};
