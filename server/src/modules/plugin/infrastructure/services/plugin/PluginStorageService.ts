import { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import Workflow, { WorkflowProps } from '@modules/plugin/domain/entities/plugin/workflow/Workflow';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import { BinaryUploadResult, IPluginStorageService, PluginImportResult } from '@modules/plugin/domain/port/plugin/IPluginStorageService';
import { WorkflowValidationMode } from '@modules/plugin/domain/port/plugin/IWorkflowValidatorService';
import WorkflowProjectionService from '@modules/plugin/utilities/plugin/WorkflowProjectionService';
import StoragePlacementService from '@modules/team-cluster/application/services/StoragePlacementService';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import PluginRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/plugin/PluginRepository';
import { WorkflowValidatorService } from '@modules/plugin/infrastructure/services/plugin/WorkflowValidatorService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IStorageService } from '@shared/domain/port/IStorageService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import archiver from 'archiver';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { inject } from 'tsyringe';
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

@Singleton()
export default class PluginStorageService implements IPluginStorageService {
    constructor(
        
        private pluginRepo: PluginRepository,

        
        private readonly storagePlacementService: StoragePlacementService,

        @inject(SHARED_TOKENS.StorageService)
        private storageService: IStorageService,

        
        private readonly workflowValidator: WorkflowValidatorService
    ){}

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

        await this.storageService.delete(SYS_BUCKETS.PLUGINS, pathToDelete);

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

    async uploadBinary(pluginId: string, _teamId: string, file: any): Promise<BinaryUploadResult> {
        const plugin = await this.pluginRepo.findById(pluginId);
        if (!plugin) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        const originalName = file.originalname || file.originalName || 'binary';
        const fileExtension = path.extname(originalName) || '';
        const uniqueName = `${v4()}${fileExtension}`;
        const objectPath = `plugin-binaries/${pluginId}/${uniqueName}`;

        const entrypointNode = plugin.props.workflow.props.nodes.find((node) => node.type === WorkflowNodeType.Entrypoint);
        const oldBinaryPath = entrypointNode?.data.entrypoint?.binaryObjectPath;
        if(oldBinaryPath){
            await this.storageService.delete(SYS_BUCKETS.PLUGINS, oldBinaryPath).catch((err) => {
                logger.warn(`@plugin-storage-service: failed to delete old binary ${oldBinaryPath}: ${err}`);
            });
        }

        const binaryHash = computeSha256(file.buffer);

        await this.storageService.upload(
            SYS_BUCKETS.PLUGINS,
            objectPath,
            file.buffer,
            {
                'Content-Type': file.mimetype || 'application/octet-stream',
                'x-amz-meta-original-name': originalName,
                'x-amz-meta-sha256': binaryHash
            }
        );

        plugin.props.workflow.updateEntrypoint({
            binary: originalName,
            binaryObjectPath: objectPath,
            binaryFileName: originalName,
            binaryHash
        });

        await this.persistWorkflow(pluginId, plugin.props.workflow);
        await this.storagePlacementService.ensurePlacement('plugin-binary', pluginId);

        logger.info(`@plugin-storage-service: binary uploaded: ${objectPath} (${file.size} bytes)`);
        return {
            objectPath,
            fileName: originalName,
            size: file.size
        };
    }

    async exportPlugin(pluginId: string): Promise<Readable> {
        const plugin = await this.pluginRepo.findById(pluginId);
        if(!plugin){
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

        const outputStream = new PassThrough();
        const archive = archiver('zip', { zlib: { level: 5 } });

        archive.on('error', (error) => outputStream.emit('error', error));
        archive.pipe(outputStream);
        archive.append(JSON.stringify(exportData, null, 2), { name: 'plugin.json' });

        if (binaryObjectPath) {
            const binaryStream = await this.storageService.getStream(SYS_BUCKETS.PLUGINS, binaryObjectPath);
            archive.append(binaryStream, { name: `binary/${binaryFileName}` });
        }
        archive.finalize();

        return outputStream;
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
        const binaryFile = directory.files.find((file) => file.path.startsWith('binary/'));
        if (binaryFile) {
            const binaryBuffer = await binaryFile.buffer();
            const binaryFileName = path.basename(binaryFile.path);
            const binaryObjectPath = `plugin-binaries/${newPlugin._id}/${v4()}-${binaryFileName}`;
            const binaryHash = computeSha256(binaryBuffer);

            await this.storageService.upload(
                SYS_BUCKETS.PLUGINS,
                binaryObjectPath,
                binaryBuffer,
                {
                    'Content-Type': 'application/octet-stream',
                    'x-amz-meta-original-name': binaryFileName,
                    'x-amz-meta-sha256': binaryHash
                }
            );

            newPlugin.props.workflow.updateEntrypoint({
                binary: binaryFileName,
                binaryObjectPath,
                binaryFileName,
                binaryHash
            });
            
            await this.persistWorkflow(newPlugin._id, newPlugin.props.workflow);
            await this.storagePlacementService.ensurePlacement('plugin-binary', newPlugin.id);

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
};
