import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type PluginRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/plugin/PluginRepository';
import { inject } from 'tsyringe';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import {
    DownloadPluginBinaryInputDTO,
    DownloadPluginBinaryOutputDTO
} from '@modules/plugin/application/dtos/plugin/DownloadPluginBinaryDTO';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import StoragePlacementService from '@modules/cluster/application/services/StoragePlacementService';
import type TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';

@Singleton()
export class DownloadPluginBinaryUseCase implements IUseCase<DownloadPluginBinaryInputDTO, DownloadPluginBinaryOutputDTO, ApplicationError> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private readonly pluginRepository: PluginRepository,
        private readonly storagePlacementService: StoragePlacementService,
        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient) private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ) {}

    async execute(input: DownloadPluginBinaryInputDTO): Promise<Result<DownloadPluginBinaryOutputDTO, ApplicationError>> {
        const plugin = await this.pluginRepository.findById(input.pluginId);
        if (!plugin) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            ));
        }

        // The route enforces team scope via RBAC, but we also reject
        // cross-team lookups defensively when the caller-provided teamId
        // does not match the plugin's owning team.
        if (plugin.props.team !== input.teamId) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            ));
        }

        const entrypointNode = plugin.props.workflow.props.nodes.find(
            (node) => node.type === WorkflowNodeType.Entrypoint
        );
        const binaryObjectPath = entrypointNode?.data.entrypoint?.binaryObjectPath;
        const binaryFileName = entrypointNode?.data.entrypoint?.binaryFileName;
        const binaryHash = entrypointNode?.data.entrypoint?.binaryHash;

        if (!binaryObjectPath) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                `Plugin binary not found for plugin ${input.pluginId}`
            ));
        }

        const placement = await this.storagePlacementService.ensurePlacement('plugin-binary', plugin.id);

        let stream;
        try {
            stream = await this.objectGatewayClient.getStream(
                placement.props.primaryClusterId,
                TEAM_CLUSTER_BUCKETS.PLUGINS,
                binaryObjectPath
            );
        } catch (error: unknown) {
            if (error instanceof ApplicationError && error.statusCode === 404) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    `Plugin binary not found for plugin ${input.pluginId}`
                ));
            }
            throw error;
        }

        const fileName = binaryFileName || `${plugin._id}.bin`;
        const response = createDownloadStreamResponse({
            stream: stream.stream,
            contentType: 'application/octet-stream',
            filename: fileName,
            cacheControl: 'no-cache'
        });

        if (binaryHash) {
            response.headers['X-Plugin-Binary-Sha256'] = binaryHash;
        }

        return Result.ok({
            ...response,
            fileName
        });
    }
}
