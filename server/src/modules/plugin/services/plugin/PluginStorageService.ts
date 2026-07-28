import type { BinaryUploadResult, BinaryUploadTarget } from '@volt/contracts/modules/plugin/domain/plugin';
export type { BinaryUploadResult, BinaryUploadTarget };
import PluginEntity from '@modules/plugin/models/Plugin';
import { toPluginLike } from '@modules/plugin/services/plugin/PluginQueries';
import type { Plugin } from '@modules/plugin/contracts/domain/plugin';
import { PluginStatus } from '@volt/contracts/modules/plugin/domain/enums';
import Workflow, { WorkflowProps } from '@modules/plugin/models/plugin/workflow/Workflow';
import { WorkflowNodeType } from '@modules/plugin/models/plugin/workflow/WorkflowTypes';
import { WorkflowValidationMode } from '@modules/plugin/services/plugin/WorkflowValidatorService';
import WorkflowProjectionService from '@modules/plugin/services/plugin/WorkflowProjection';
import type {
    IClusterObjectArchiveService,
    IClusterObjectSignedUrlService,
    IStoragePlacementService,
    ITeamClusterObjectGatewayClient
} from '@shared/contracts/ports';

import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import { WorkflowValidatorService } from '@modules/plugin/services/plugin/WorkflowValidatorService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import logger from '@shared/infrastructure/logger';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { DeepPartial } from 'typeorm';
import unzipper from 'unzipper';
import { v4 } from 'uuid';

export interface PluginImportResult {
    plugin: Plugin;
    binaryImported: boolean;
}

const detectArchiveRootPrefix = (paths: string[]): string => {
    const topLevelSegments = new Set<string>();

    for (const entryPath of paths) {
        const firstSegment = entryPath.split('/')[0];
        if (firstSegment.length > 0) {
            topLevelSegments.add(firstSegment);
        }
    }

    if (topLevelSegments.size !== 1) {
        return '';
    }

    const [onlySegment] = [...topLevelSegments];
    const isWrapperDir = paths.some((entryPath) => entryPath.startsWith(`${onlySegment}/`));
    return isWrapperDir ? `${onlySegment}/` : '';
};

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

export default class PluginStorageService {
    constructor(
        private readonly storagePlacementService: IStoragePlacementService,
        private readonly objectGatewayClient: ITeamClusterObjectGatewayClient,
        private readonly workflowValidator: WorkflowValidatorService,
        private readonly signedUrlService: IClusterObjectSignedUrlService,
        private readonly archiveService: IClusterObjectArchiveService
    ) {}

    private async resolveOwnerClusterId(pluginId: string): Promise<string> {
        const placement = await this.storagePlacementService.ensurePlacement('plugin-binary', pluginId);
        return placement.props.primaryClusterId;
    }

    private async persistWorkflow(pluginId: string, workflow: Workflow): Promise<void> {
        const projection = WorkflowProjectionService.project(workflow, pluginId);
        const pluginEntity = await PluginEntity.findOneBy({ id: pluginId });

        if (!pluginEntity) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        await Object.assign(pluginEntity, {
            workflow: workflow.props,
            modifier: projection.modifier,
            exposures: projection.exposures,
            arguments: projection.arguments,
            listingExposures: projection.listingExposures
        }).save();
    }

    async deleteBinary(pluginId: string): Promise<void> {
        const pluginEntity = await PluginEntity.findOneBy({ id: pluginId });
        const plugin = pluginEntity ? toPluginLike(pluginEntity) : null;
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

        if (plugin.props.status === PluginStatus.PUBLISHED) {
            await PluginEntity.update({ id: pluginId }, { status: PluginStatus.DRAFT });
            plugin.props.status = PluginStatus.DRAFT;
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
        const pluginEntity = await PluginEntity.findOneBy({ id: pluginId });
        if (!pluginEntity) {
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
        const pluginEntity = await PluginEntity.findOneBy({ id: pluginId });
        const plugin = pluginEntity ? toPluginLike(pluginEntity) : null;
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
        const pluginEntity = await PluginEntity.findOneBy({ id: pluginId });
        const plugin = pluginEntity ? toPluginLike(pluginEntity) : null;
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

        const archivePrefix = detectArchiveRootPrefix(directory.files.map((file) => file.path));
        const resolveEntry = (relativePath: string): unzipper.File | undefined =>
            directory.files.find((file) => file.path === `${archivePrefix}${relativePath}`);

        const pluginJsonFile = resolveEntry('plugin.json');
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

        const requestedStatus = status ?? PluginStatus.PUBLISHED;
        const workflow = new Workflow('', importData.workflow);
        workflow.updateEntrypoint({
            binary: undefined,
            binaryObjectPath: undefined,
            binaryFileName: undefined
        });
        const projection = WorkflowProjectionService.project(workflow, '');

        const newPluginEntity = await PluginEntity.create({
            workflow: workflow.props,
            status: requestedStatus === PluginStatus.PUBLISHED
                ? PluginStatus.DRAFT
                : requestedStatus,
            team: teamId,
            modifier: projection.modifier,
            exposures: projection.exposures,
            arguments: projection.arguments,
            listingExposures: projection.listingExposures
        }).save();
        const newPlugin = toPluginLike(newPluginEntity);

        let binaryImported = false;
        let persistedPlugin = newPlugin;
        const binaryFile = directory.files.find((file) => {
            return file.path.startsWith(`${archivePrefix}binary/`)
                && file.path !== `${archivePrefix}binary/`
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

        if (requestedStatus === PluginStatus.PUBLISHED) {
            const validation = await this.workflowValidator.validate(
                newPlugin.props.workflow.props,
                newPlugin.id,
                WorkflowValidationMode.Strict
            );

            if (validation.isValid) {
                const publishedEntity = await PluginEntity.findOneBy({ id: newPlugin.id });
                persistedPlugin = publishedEntity
                    ? toPluginLike(await Object.assign(publishedEntity, { status: PluginStatus.PUBLISHED }).save())
                    : newPlugin;
                persistedPlugin.props.status = PluginStatus.PUBLISHED;
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

    private async findByTeamAndModifierKey(teamId: string, modifierKey: string): Promise<PluginEntity | null> {
        const candidates = await PluginEntity.find({
            where: { team: teamId },
            select: {
                id: true,
                modifier: true
            },
            order: { createdAt: 'ASC' }
        });

        const match = candidates.find((candidate) => candidate.modifier?.key?.trim() === modifierKey);

        return match ? PluginEntity.findOneBy({ id: match.id }) : null;
    }

    private async publishIfValid(plugin: Plugin): Promise<Plugin> {
        const validation = await this.workflowValidator.validate(
            plugin.props.workflow.props,
            plugin.id,
            WorkflowValidationMode.Strict
        );

        if (!validation.isValid) {
            logger.warn(
                {
                    pluginId: plugin.id,
                    validationErrors: validation.errors
                },
                '@plugin-storage-service: plugin left in draft because it is not ready to publish'
            );
            return plugin;
        }

        const publishedEntity = await PluginEntity.findOneBy({ id: plugin.id });
        const published = publishedEntity
            ? toPluginLike(await Object.assign(publishedEntity, { status: PluginStatus.PUBLISHED }).save())
            : plugin;
        published.props.status = PluginStatus.PUBLISHED;
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
            workflow: workflow.props,
            status: PluginStatus.DRAFT,
            team: teamId,
            modifier: projection.modifier,
            exposures: projection.exposures,
            arguments: projection.arguments,
            listingExposures: projection.listingExposures
        } satisfies DeepPartial<PluginEntity>;

        const modifierKey = projection.modifier?.key?.trim();
        const existingEntity = modifierKey
            ? await this.findByTeamAndModifierKey(teamId, modifierKey)
            : null;
        const existing = existingEntity ? toPluginLike(existingEntity) : null;

        let newPlugin: Plugin;
        if (existingEntity && existing) {
            newPlugin = toPluginLike(await Object.assign(existingEntity, pluginProps).save());
        } else {
            const createdEntity = await PluginEntity.create(pluginProps).save();
            newPlugin = toPluginLike(createdEntity);
        }

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
