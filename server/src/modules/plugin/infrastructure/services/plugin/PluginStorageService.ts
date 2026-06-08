import Plugin, { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import Workflow, { WorkflowProps } from '@modules/plugin/domain/entities/plugin/workflow/Workflow';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import { BinaryUploadResult, BinaryUploadTarget, IPluginStorageService, PluginImportResult } from '@modules/plugin/domain/port/plugin/IPluginStorageService';
import { WorkflowValidationMode } from '@modules/plugin/domain/port/plugin/IWorkflowValidatorService';
import WorkflowProjectionService from '@modules/plugin/utilities/plugin/WorkflowProjectionService';
import StoragePlacementService from '@modules/cluster/application/services/StoragePlacementService';
import ClusterObjectArchiveService from '@modules/cluster/infrastructure/services/ClusterObjectArchiveService';
import ClusterObjectSignedUrlService from '@modules/cluster/infrastructure/services/ClusterObjectSignedUrlService';
import TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import PluginRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/plugin/PluginRepository';
import { WorkflowValidatorService } from '@modules/plugin/infrastructure/services/plugin/WorkflowValidatorService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import logger from '@shared/infrastructure/logger';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { Readable } from 'node:stream';
import unzipper from 'unzipper';
import { v4 } from 'uuid';

const isWorkflowProps = (value: unknown): value is WorkflowProps => {
    if (!isRecord(value)) {
        return false;
    }

    if (!Array.isArray(value.nodes)) {
        return false;
    }

    if (!Array.isArray(value.edges)) {
        return false;
    }

    return true;
};

const computeSha256 = (buffer: Buffer): string => {
    return createHash('sha256').update(buffer).digest('hex');
};

const normalizeBinaryFileName = (fileName: string): string => {
    const normalized = path.basename(fileName.trim());
    return normalized.length > 0 ? normalized : 'binary';
};

@Singleton(PLUGIN_TOKENS.PluginStorageService)
export default class PluginStorageService implements IPluginStorageService {
    constructor(
        private pluginRepo: PluginRepository,
        private readonly storagePlacementService: StoragePlacementService,
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient,
        private readonly workflowValidator: WorkflowValidatorService,
        private readonly signedUrlService: ClusterObjectSignedUrlService,
        private readonly archiveService: ClusterObjectArchiveService
    ) {}

    private async resolveOwnerClusterId(pluginId: string): Promise<string> {
        const placement = await this.storagePlacementService.ensurePlacement('plugin-binary', pluginId);
        return placement.props.primaryClusterId;
    }

    private async persistWorkflow(pluginId: string, workflow: Workflow): Promise<void> {
        const projection = WorkflowProjectionService.project(workflow, pluginId);
        const updatedPlugin = await this.pluginRepo.updateById(pluginId, {
            workflow,
            modifier: projection.modifier,
            exposures: projection.exposures,
            arguments: projection.arguments,
            listingExposures: projection.listingExposures
        });

        if (!updatedPlugin) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }
    }

    async deleteBinary(pluginId: string): Promise<void> {
        const plugin = await this.pluginRepo.findById(pluginId);
        if (!plugin) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        const entrypointNode = plugin.props.workflow.props.nodes.find((node) => node.type === WorkflowNodeType.Entrypoint);
        const pathToDelete = entrypointNode?.data.entrypoint?.binaryObjectPath;
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

        await this.persistWorkflow(pluginId, plugin.props.workflow);

        if (plugin.props.status === PluginStatus.Published) {
            await this.pluginRepo.updateById(pluginId, {
                status: PluginStatus.Draft
            });
            plugin.props.status = PluginStatus.Draft;
        }

        logger.info(`@plugin-storage-service: binary deleted: ${pathToDelete}`);
    }

    async createBinaryUploadTarget(
        pluginId: string,
        teamId: string,
        input: {
            userId: string;
            fileName: string;
            size: number;
            contentType?: string;
            sha256?: string;
        }
    ): Promise<BinaryUploadTarget> {
        const plugin = await this.pluginRepo.findById(pluginId);
        if (!plugin) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        const originalName = normalizeBinaryFileName(input.fileName);
        const fileExtension = path.extname(originalName) || '';
        const uniqueName = `${v4()}${fileExtension}`;
        const objectPath = `plugin-binaries/${pluginId}/${uniqueName}`;
        const ownerClusterId = await this.resolveOwnerClusterId(pluginId);
        const signed = this.signedUrlService.createToken({
            kind: 'cluster-object',
            operation: 'write',
            teamId,
            userId: input.userId,
            ownerClusterId,
            bucket: TEAM_CLUSTER_BUCKETS.PLUGINS,
            objectKey: objectPath,
            resourceKind: 'plugin-binary',
            resourceId: pluginId,
            contentLength: input.size,
            contentType: input.contentType || 'application/octet-stream',
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

    async commitBinaryUpload(
        pluginId: string,
        _teamId: string,
        input: {
            objectPath: string;
            fileName: string;
            size: number;
            sha256?: string;
        }
    ): Promise<BinaryUploadResult> {
        const plugin = await this.pluginRepo.findById(pluginId);
        if (!plugin) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        if (!input.objectPath.startsWith(`plugin-binaries/${pluginId}/`)) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'Invalid plugin binary object path'
            );
        }

        const ownerClusterId = await this.resolveOwnerClusterId(pluginId);
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
        const entrypointNode = plugin.props.workflow.props.nodes.find((node) => node.type === WorkflowNodeType.Entrypoint);
        const oldBinaryPath = entrypointNode?.data.entrypoint?.binaryObjectPath;
        if (oldBinaryPath && oldBinaryPath !== input.objectPath) {
            await this.objectGatewayClient.deleteObject(ownerClusterId, TEAM_CLUSTER_BUCKETS.PLUGINS, oldBinaryPath).catch((err) => {
                logger.warn(`@plugin-storage-service: failed to delete old binary ${oldBinaryPath}: ${err}`);
            });
        }

        plugin.props.workflow.updateEntrypoint({
            binary: originalName,
            binaryObjectPath: input.objectPath,
            binaryFileName: originalName,
            binaryHash: sha256
        });

        await this.persistWorkflow(pluginId, plugin.props.workflow);
        logger.info(`@plugin-storage-service: binary uploaded: ${input.objectPath} (${input.size} bytes)`);
        return {
            objectPath: input.objectPath,
            fileName: originalName,
            size: input.size,
            binaryHash: sha256
        };
    }

    async exportPlugin(pluginId: string): Promise<Readable> {
        const plugin = await this.pluginRepo.findById(pluginId);
        if (!plugin) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        const exportData = {
            workflow: plugin.props.workflow.props,
            status: plugin.props.status,
            exportedAt: new Date().toISOString()
        };

        const entrypointNode = plugin.props.workflow.props.nodes.find((node) => node.type === WorkflowNodeType.Entrypoint);
        const binaryObjectPath = entrypointNode?.data.entrypoint?.binaryObjectPath;
        const binaryFileName = entrypointNode?.data.entrypoint?.binaryFileName;

        const ownerClusterId = await this.resolveOwnerClusterId(pluginId);
        const archive = await this.archiveService.createArchiveDownload({
            teamClusterId: ownerClusterId,
            outputBucket: TEAM_CLUSTER_BUCKETS.TRAJECTORIES,
            outputObjectKey: `exports/plugins/${pluginId}/${v4()}.zip`,
            filename: `${pluginId}.zip`,
            entries: [
                {
                    type: 'inline',
                    name: 'plugin.json',
                    content: JSON.stringify(exportData, null, 2)
                },
                ...(binaryObjectPath ? [{
                    type: 'object' as const,
                    ownerClusterId,
                    bucket: TEAM_CLUSTER_BUCKETS.PLUGINS,
                    objectKey: binaryObjectPath,
                    name: `binary/${binaryFileName || path.basename(binaryObjectPath)}`,
                    optional: true
                }] : [])
            ]
        });

        return archive.stream;
    }

    async importPlugin(fileBuffer: Buffer, teamId: string, status?: PluginStatus): Promise<PluginImportResult> {
        let directory: unzipper.CentralDirectory;

        try {
            directory = await unzipper.Open.buffer(fileBuffer);
        } catch {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'Invalid plugin ZIP archive'
            );
        }

        const pluginJsonFile = directory.files.find((file) => file.path === 'plugin.json');
        if (!pluginJsonFile) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'Invalid plugin ZIP archive: plugin.json is required'
            );
        }

        const pluginJsonBuffer = await pluginJsonFile.buffer();
        let importData: unknown;

        try {
            importData = JSON.parse(pluginJsonBuffer.toString('utf-8'));
        } catch {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'Invalid plugin manifest JSON'
            );
        }

        if (!isRecord(importData) || !isWorkflowProps(importData.workflow)) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'Invalid plugin import format: workflow is required'
            );
        }

        const requestedStatus = status ?? PluginStatus.Published;
        const workflow = new Workflow('', importData.workflow);
        workflow.updateEntrypoint({
            binary: undefined,
            binaryObjectPath: undefined,
            binaryFileName: undefined
        });
        const projection = WorkflowProjectionService.project(workflow, '');

        const newPlugin = await this.pluginRepo.create({
            workflow,
            status: requestedStatus === PluginStatus.Published
                ? PluginStatus.Draft
                : requestedStatus,
            team: teamId,
            modifier: projection.modifier,
            exposures: projection.exposures,
            arguments: projection.arguments,
            listingExposures: projection.listingExposures
        });

        let binaryImported = false;
        let persistedPlugin = newPlugin;
        const binaryFile = directory.files.find((file) => {
            return file.path.startsWith('binary/')
                && file.path !== 'binary/'
                && file.type !== 'Directory';
        });
        if (binaryFile) {
            const binaryBuffer = await binaryFile.buffer();
            const binaryFileName = path.basename(binaryFile.path);
            const binaryObjectPath = `plugin-binaries/${newPlugin._id}/${v4()}-${binaryFileName}`;
            const binaryHash = computeSha256(binaryBuffer);

            const ownerClusterId = await this.resolveOwnerClusterId(newPlugin.id);
            await this.objectGatewayClient.putBuffer(ownerClusterId, {
                bucket: TEAM_CLUSTER_BUCKETS.PLUGINS,
                objectKey: binaryObjectPath,
                buffer: binaryBuffer,
                contentLength: binaryBuffer.length,
                contentType: 'application/octet-stream',
                metadata: {
                    'original-name': binaryFileName,
                    sha256: binaryHash
                }
            });

            newPlugin.props.workflow.updateEntrypoint({
                binary: binaryFileName,
                binaryObjectPath,
                binaryFileName,
                binaryHash
            });

            await this.persistWorkflow(newPlugin._id, newPlugin.props.workflow);
            logger.info(`@plugin-workflow-service: imported binary ${binaryObjectPath}`);
            binaryImported = true;
        }

        if (requestedStatus === PluginStatus.Published) {
            const validation = await this.workflowValidator.validate(
                newPlugin.props.workflow.props,
                newPlugin.id,
                WorkflowValidationMode.Strict
            );

            if (validation.isValid) {
                persistedPlugin = await this.pluginRepo.updateById(newPlugin.id, {
                    status: PluginStatus.Published
                }) ?? newPlugin;
                persistedPlugin.props.status = PluginStatus.Published;
            } else {
                logger.warn(
                    {
                        pluginId: newPlugin.id,
                        binaryImported,
                        validationErrors: validation.errors
                    },
                    '@plugin-storage-service: imported plugin left in draft because it is not ready to publish'
                );
            }
        }

        logger.info(`@plugin-storage-service: plugin imported ${newPlugin._id}`);
        return {
            plugin: persistedPlugin,
            binaryImported
        };
    }

    private async publishIfValid(plugin: Plugin): Promise<Plugin> {
        const validation = await this.workflowValidator.validate(
            plugin.props.workflow.props,
            plugin.id,
            WorkflowValidationMode.Strict
        );

        if (!validation.isValid) {
            logger.warn(
                { pluginId: plugin.id, validationErrors: validation.errors },
                '@plugin-storage-service: plugin left in draft because it is not ready to publish'
            );
            return plugin;
        }

        const published = await this.pluginRepo.updateById(plugin.id, { status: PluginStatus.Published }) ?? plugin;
        published.props.status = PluginStatus.Published;
        return published;
    }

    async createFromRegistry(
        workflowProps: unknown,
        binary: { objectPath: string; fileName: string; hash: string; sizeBytes: number },
        ownerClusterId: string,
        teamId: string
    ): Promise<PluginImportResult> {
        if (!isWorkflowProps(workflowProps)) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'Invalid plugin workflow from registry'
            );
        }

        const workflow = new Workflow('', workflowProps);
        const projection = WorkflowProjectionService.project(workflow, '');
        const pluginProps = {
            workflow,
            status: PluginStatus.Draft,
            team: teamId,
            modifier: projection.modifier,
            exposures: projection.exposures,
            arguments: projection.arguments,
            listingExposures: projection.listingExposures
        };

        const existing = projection.modifier?.key
            ? await this.pluginRepo.findByTeamAndModifierKey(teamId, projection.modifier.key)
            : null;

        const newPlugin = existing
            ? (await this.pluginRepo.updateById(existing.id, pluginProps)) ?? existing
            : await this.pluginRepo.create(pluginProps);

        // Pin the binary placement to the cluster that downloaded and stored it.
        await this.storagePlacementService.assignPluginBinaryPlacement(newPlugin.id, teamId, ownerClusterId);

        newPlugin.props.workflow.updateEntrypoint({
            binary: binary.fileName,
            binaryObjectPath: binary.objectPath,
            binaryFileName: binary.fileName,
            binaryHash: binary.hash
        });
        await this.persistWorkflow(newPlugin._id, newPlugin.props.workflow);

        const persistedPlugin = await this.publishIfValid(newPlugin);
        logger.info(`@plugin-storage-service: plugin installed from registry ${newPlugin._id}`);
        return {
            plugin: persistedPlugin,
            binaryImported: true
        };
    }
}
