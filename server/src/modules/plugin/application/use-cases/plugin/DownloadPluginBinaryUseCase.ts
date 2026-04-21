import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import {
    DownloadPluginBinaryInputDTO,
    DownloadPluginBinaryOutputDTO
} from '@modules/plugin/application/dtos/plugin/DownloadPluginBinaryDTO';
import { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';

import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IUseCase } from '@shared/application/IUseCase';
import { IStorageService } from '@shared/domain/port/IStorageService';
import { Result } from '@shared/domain/port/Result';
import { isStorageObjectNotFoundError } from '@shared/infrastructure/utilities/storage-errors';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { injectable, inject } from 'tsyringe';

@injectable()
export class DownloadPluginBinaryUseCase implements IUseCase<DownloadPluginBinaryInputDTO, DownloadPluginBinaryOutputDTO, ApplicationError> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository,
        @inject(SHARED_TOKENS.StorageService) private storageService: IStorageService
    ){}

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

        let stream;
        try {
            stream = await this.storageService.getStream(SYS_BUCKETS.PLUGINS, binaryObjectPath);
        } catch (error: unknown) {
            if (isStorageObjectNotFoundError(error)) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    `Plugin binary not found for plugin ${input.pluginId}`
                ));
            }
            throw error;
        }

        const fileName = binaryFileName || `${plugin._id}.bin`;
        const response = createDownloadStreamResponse({
            stream,
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
};
