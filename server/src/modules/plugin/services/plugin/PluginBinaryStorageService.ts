import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import PluginEntity from '@modules/plugin/models/Plugin';
import type { Plugin } from '@modules/plugin/contracts/plugin';
import {
    persistProjectedWorkflow,
    requirePlugin,
    requirePluginEntity
} from '@modules/plugin/services/plugin/PluginQueries';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IClusterObjectSignedUrlService } from '@shared/contracts/ports/IClusterObjectSignedUrlService';
import type { IStoragePlacementService } from '@shared/contracts/ports/IStoragePlacementService';
import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports/ITeamClusterObjectGatewayClient';
import type { DownloadStreamOutput } from '@shared/contracts/types/DownloadStream';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import logger from '@shared/infrastructure/logger';
import { PluginStatus } from '@volt/contracts/modules/plugin/enums';
import type {
    CommitBinaryUploadInput as WireCommitBinaryUploadInput,
    UploadBinaryInput as WireUploadBinaryInput
} from '@volt/contracts/modules/plugin/http';
import type { BinaryUploadResult, BinaryUploadTarget } from '@volt/contracts/modules/plugin/plugin';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { v4 } from 'uuid';

interface CreateBinaryUploadTargetInput extends WireUploadBinaryInput {
    pluginId: string;
    teamId: string;
    userId: string;
}

interface CommitBinaryUploadInput extends WireCommitBinaryUploadInput {
    pluginId: string;
}

export const computeSha256 = (buffer: Buffer): string => {
    return createHash('sha256').update(buffer).digest('hex');
};

const normalizeBinaryFileName = (fileName: string): string => {
    return path.basename(fileName.trim()) || 'binary';
};

/**
 * Owns the lifecycle of a plugin's executable in cluster object storage: hand out
 * a signed upload target, accept the upload once it landed, and drop it again.
 */
export default class PluginBinaryStorageService {
    constructor(
        private readonly storagePlacementService: IStoragePlacementService,
        private readonly objectGatewayClient: ITeamClusterObjectGatewayClient,
        private readonly signedUrlService: IClusterObjectSignedUrlService
    ) {}

    private async resolveOwnerClusterId(pluginId: string): Promise<string> {
        const placement = await this.storagePlacementService.ensurePlacement('plugin-binary', pluginId);
        return placement.props.primaryClusterId;
    }

    async createUploadTarget(input: CreateBinaryUploadTargetInput): Promise<BinaryUploadTarget> {
        await requirePluginEntity(input.pluginId);

        const originalName = normalizeBinaryFileName(input.fileName);
        const objectPath = `plugin-binaries/${input.pluginId}/${v4()}${path.extname(originalName)}`;
        const signed = this.signedUrlService.createToken({
            kind: 'cluster-object',
            operation: 'write',
            teamId: input.teamId,
            userId: input.userId,
            ownerClusterId: await this.resolveOwnerClusterId(input.pluginId),
            bucket: TEAM_CLUSTER_BUCKETS.PLUGINS,
            objectKey: objectPath,
            resourceKind: 'plugin-binary',
            resourceId: input.pluginId,
            contentLength: input.size,
            contentType: input.type || 'application/octet-stream',
            metadata: {
                'original-name': originalName,
                ...(input.sha256 ? { sha256: input.sha256 } : {})
            }
        });

        return {
            objectPath,
            fileName: originalName,
            size: input.size,
            binaryHash: input.sha256 ?? '',
            uploadUrl: signed.url,
            expiresAt: signed.expiresAt
        };
    }

    async commitUpload(input: CommitBinaryUploadInput): Promise<BinaryUploadResult> {
        const plugin = await requirePlugin(input.pluginId);

        if (!input.objectPath.startsWith(`plugin-binaries/${input.pluginId}/`)) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'Invalid plugin binary object path'
            );
        }

        const ownerClusterId = await this.resolveOwnerClusterId(input.pluginId);
        const head = await this.objectGatewayClient.head(ownerClusterId, TEAM_CLUSTER_BUCKETS.PLUGINS, input.objectPath);
        if (head.contentLength !== input.size) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'Uploaded plugin binary size does not match the requested upload'
            );
        }

        let sha256 = input.sha256;

        if (!sha256) {
            const buffer = await this.objectGatewayClient.getBuffer(ownerClusterId, TEAM_CLUSTER_BUCKETS.PLUGINS, input.objectPath);
            sha256 = computeSha256(buffer);
        } else if (head.metadata.sha256 && head.metadata.sha256 !== sha256) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'Uploaded plugin binary hash metadata does not match the requested upload'
            );
        }

        const originalName = normalizeBinaryFileName(input.fileName);
        const oldBinaryPath = plugin.props.workflow.entrypoint?.binaryObjectPath;
        if (oldBinaryPath && oldBinaryPath !== input.objectPath) {
            await this.objectGatewayClient.deleteObject(ownerClusterId, TEAM_CLUSTER_BUCKETS.PLUGINS, oldBinaryPath).catch((err) => {
                logger.warn(`@plugin-binary-storage-service: failed to delete old binary ${oldBinaryPath}: ${err}`);
            });
        }

        plugin.props.workflow.updateEntrypoint({
            binary: originalName,
            binaryObjectPath: input.objectPath,
            binaryFileName: originalName,
            binaryHash: sha256
        });

        await persistProjectedWorkflow(input.pluginId, plugin.props.workflow);
        logger.info(`@plugin-binary-storage-service: binary uploaded: ${input.objectPath} (${input.size} bytes)`);

        return {
            objectPath: input.objectPath,
            fileName: originalName,
            size: input.size,
            binaryHash: sha256
        };
    }

    async deleteBinary(pluginId: string): Promise<void> {
        const plugin: Plugin = await requirePlugin(pluginId);
        const pathToDelete = plugin.props.workflow.entrypoint?.binaryObjectPath;
        if (!pathToDelete) {
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                `Plugin binary not found for plugin ${pluginId}`
            );
        }

        const ownerClusterId = await this.resolveOwnerClusterId(pluginId);
        await this.objectGatewayClient.deleteObject(ownerClusterId, TEAM_CLUSTER_BUCKETS.PLUGINS, pathToDelete);

        plugin.props.workflow.updateEntrypoint({
            binaryObjectPath: undefined,
            binaryFileName: undefined,
            binary: undefined
        });

        await persistProjectedWorkflow(pluginId, plugin.props.workflow);

        if (plugin.props.status === PluginStatus.PUBLISHED) {
            await PluginEntity.update({ id: pluginId }, { status: PluginStatus.DRAFT });
        }

        logger.info(`@plugin-binary-storage-service: binary deleted: ${pathToDelete}`);
    }

    async downloadBinary(pluginId: string, teamId: string): Promise<DownloadStreamOutput> {
        const plugin = await requirePlugin(pluginId);

        // A plugin of another team is reported as missing rather than forbidden.
        if (plugin.props.team !== teamId) {
            throw ApplicationError.notFound(ErrorCodes.PLUGIN_NOT_FOUND, 'Plugin not found');
        }

        const entrypoint = plugin.props.workflow.entrypoint;
        if (!entrypoint?.binaryObjectPath) {
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                `Plugin binary not found for plugin ${pluginId}`
            );
        }

        const ownerClusterId = await this.resolveOwnerClusterId(pluginId);

        let stream;
        try {
            stream = await this.objectGatewayClient.getStream(
                ownerClusterId,
                TEAM_CLUSTER_BUCKETS.PLUGINS,
                entrypoint.binaryObjectPath
            );
        } catch (error: unknown) {
            if (error instanceof ApplicationError && error.statusCode === 404) {
                throw ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    `Plugin binary not found for plugin ${pluginId}`
                );
            }
            throw error;
        }

        return createDownloadStreamResponse({
            stream: stream.stream,
            contentType: 'application/octet-stream',
            filename: entrypoint.binaryFileName || `${pluginId}.bin`,
            cacheControl: 'no-cache',
            extraHeaders: entrypoint.binaryHash ? { 'X-Plugin-Binary-Sha256': entrypoint.binaryHash } : undefined
        });
    }
}
