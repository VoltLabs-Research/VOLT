import { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import Workflow, { WorkflowProps } from '@modules/plugin/domain/entities/plugin/workflow/Workflow';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import { IPluginBinaryCacheService } from '@modules/plugin/domain/port/plugin/IPluginBinaryCacheService';
import { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import { BinaryUploadResult, IPluginStorageService, PluginImportResult } from '@modules/plugin/domain/port/plugin/IPluginStorageService';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import WorkflowProjectionService from '@modules/plugin/utilities/plugin/WorkflowProjectionService';

import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { IStorageService } from '@shared/domain/port/IStorageService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import { PassThrough, Readable } from 'node:stream';
import { injectable, inject } from 'tsyringe';
import { v4 } from 'uuid';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';
import archiver from 'archiver';
import path from 'node:path';
import unzipper from 'unzipper';

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

@injectable()
export default class PluginStorageService implements IPluginStorageService {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private pluginRepo: IPluginRepository,

        @inject(SHARED_TOKENS.StorageService)
        private storageService: IStorageService,

        @inject(PLUGIN_TOKENS.PluginBinaryCacheService)
        private binaryCacheService: IPluginBinaryCacheService
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
        await this.binaryCacheService.evictByPluginId(pluginId);

        plugin.props.workflow.updateEntrypoint({
            binaryObjectPath: undefined,
            binaryFileName: undefined,
            binary: undefined
        });

        await this.persistWorkflow(pluginId, plugin.props.workflow);

        logger.info(`@plugin-storage-service: binary deleted: ${pathToDelete}`);
    }

    async uploadBinary(pluginId: string, file: any): Promise<BinaryUploadResult> {
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

        // Delete the old binary from storage if one exists (prevents orphaned files)
        const entrypointNode = plugin.props.workflow.props.nodes.find((node) => node.type === WorkflowNodeType.Entrypoint);
        const oldBinaryPath = entrypointNode?.data.entrypoint?.binaryObjectPath;
        if(oldBinaryPath){
            await this.storageService.delete(SYS_BUCKETS.PLUGINS, oldBinaryPath).catch((err) => {
                logger.warn(`@plugin-storage-service: failed to delete old binary ${oldBinaryPath}: ${err}`);
            });
        }

        await this.binaryCacheService.evictByPluginId(pluginId);

        await this.storageService.upload(
            SYS_BUCKETS.PLUGINS,
            objectPath,
            file.buffer,
            {
                'Content-Type': file.mimetype || 'application/octet-stream',
                'x-amz-meta-original-name': originalName
            }
        );

        plugin.props.workflow.updateEntrypoint({
            binary: originalName,
            binaryObjectPath: objectPath,
            binaryFileName: originalName
        });

        await this.persistWorkflow(pluginId, plugin.props.workflow);

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
            validated: plugin.props.validated,
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

        const workflow = new Workflow('', importData.workflow);
        const projection = WorkflowProjectionService.project(workflow, '');

        const newPlugin = await this.pluginRepo.create({
            workflow,
            status: status ?? PluginStatus.Draft,
            team: teamId,
            validated: Boolean(importData.validated),
            validationErrors: Array.isArray(importData.validationErrors) ? importData.validationErrors : [],
            modifier: projection.modifier,
            exposures: projection.exposures,
            arguments: projection.arguments,
            listingExposures: projection.listingExposures
        });

        let binaryImported = false;
        const binaryFile = directory.files.find((file) => file.path.startsWith('binary/'));
        if (binaryFile) {
            const binaryBuffer = await binaryFile.buffer();
            const binaryFileName = path.basename(binaryFile.path);
            const binaryObjectPath = `plugin-binaries/${newPlugin._id}/${v4()}-${binaryFileName}`;

            await this.storageService.upload(
                SYS_BUCKETS.PLUGINS,
                binaryObjectPath,
                binaryBuffer,
                {
                    'Content-Type': 'application/octet-stream',
                    'x-amz-meta-original-name': binaryFileName
                }
            );

            newPlugin.props.workflow.updateEntrypoint({
                binaryObjectPath,
                binaryFileName
            });
            
            await this.persistWorkflow(newPlugin._id, newPlugin.props.workflow);

            logger.info(`@plugin-workflow-service: imported binary ${binaryObjectPath}`);
            binaryImported = true;
        }

        logger.info(`@plugin-storage-service: plugin imported ${newPlugin._id}`);
        return {
            plugin: newPlugin,
            binaryImported
        };
    }
};
