import { BinaryUploadResult, IPluginStorageService, PluginImportResult } from "@/src/modules/plugin/domain/ports/IPluginStorageService";
import { injectable, inject } from 'tsyringe';
import { PassThrough, Readable } from "node:stream";
import archiver from "archiver";
import unzipper from 'unzipper';
import { PluginStatus } from "@/src/modules/plugin/domain/entities/Plugin";
import { ErrorCodes } from "@/src/core/constants/error-codes";
import { WorkflowNodeType } from "@/src/modules/plugin/domain/entities/workflow/WorkflowNode";
import { SHARED_TOKENS } from "@/src/shared/infrastructure/di/SharedTokens";
import { IStorageService } from "@/src/shared/domain/ports/IStorageService";
import { SYS_BUCKETS } from "@/src/core/minio";
import { PLUGIN_TOKENS } from "../di/PluginTokens";
import { IPluginRepository } from "@/src/modules/plugin/domain/ports/IPluginRepository";
import path from 'node:path';
import { v4 } from "uuid";
import logger from "@/src/shared/infrastructure/logger";

@injectable()
export default class PluginStorageService implements IPluginStorageService {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private pluginRepo: IPluginRepository,

        @inject(SHARED_TOKENS.StorageService)
        private storageService: IStorageService
    ) { }

    async deleteBinary(pluginId: string): Promise<void> {
        const plugin = await this.pluginRepo.findById(pluginId);
        if (!plugin) {
            throw new Error(ErrorCodes.PLUGIN_NOT_FOUND);
        }

        const entrypointNode = plugin.props.workflow.props.nodes.find((node) => node.type === WorkflowNodeType.Entrypoint);
        const pathToDelete = entrypointNode?.data.entrypoint?.binaryObjectPath;
        if (!pathToDelete) {
            throw new Error('Plugin::DeleteBinary::PathRequired');
        }

        await this.storageService.delete(SYS_BUCKETS.PLUGINS, pathToDelete);

        plugin.props.workflow.updateEntrypoint({
            binaryObjectPath: undefined,
            binaryFileName: undefined,
            binary: undefined
        });

        await this.pluginRepo.updateById(pluginId, { workflow: plugin.props.workflow });

        logger.info(`@plugin-storage-service: binary deleted: ${pathToDelete}`);
    }

    async uploadBinary(pluginId: string, file: any): Promise<BinaryUploadResult> {
        const plugin = await this.pluginRepo.findById(pluginId);
        if (!plugin) {
            throw new Error(ErrorCodes.PLUGIN_NOT_FOUND);
        }

        const fileExtension = path.extname(file.originalName) || '';
        const uniqueName = `${v4()}${fileExtension}`;
        const objectPath = `plugin-binaries/${pluginId}/${uniqueName}`;

        await this.storageService.upload(
            SYS_BUCKETS.PLUGINS,
            objectPath,
            file.buffer,
            {
                'Content-Type': file.mimetype || 'application/octet-stream',
                'x-amz-meta-original-name': file.originalName
            }
        );

        plugin.props.workflow.updateEntrypoint({
            binary: file.originalName,
            binaryObjectPath: objectPath,
            binaryFileName: file.originalName
        });

        await this.pluginRepo.updateById(pluginId, { workflow: plugin.props.workflow });

        logger.info(`@plugin-storage-service: binary uploaded: ${objectPath} (${file.size} bytes)`);
        return {
            objectPath,
            fileName: file.originalName,
            size: file.size
        };
    }

    async exportPlugin(pluginId: string): Promise<Readable> {
        const plugin = await this.pluginRepo.findById(pluginId);
        if(!plugin){
            throw new Error(ErrorCodes.PLUGIN_NOT_FOUND);
        }

        const exportData = {
            slug: plugin.props.slug,
            workflow: plugin.props.workflow,
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

    async importPlugin(fileBuffer: Buffer, teamId: string): Promise<PluginImportResult> {
        const directory = await unzipper.Open.buffer(fileBuffer);
        const pluginJsonFile = directory.files.find((file) => file.path === 'plugin.json');
        if (!pluginJsonFile) {
            throw new Error('Plugin::Import::InvalidZip');
        }

        const pluginJsonBuffer = await pluginJsonFile.buffer();
        const importData = JSON.parse(pluginJsonBuffer.toString('utf-8'));
        if (!importData.workflow) {
            throw new Error('Plugin::Import::InvalidFormat');
        }

        const uniqueSlug = `${importData.slug}-${Date.now()}`;
        const newPlugin = await this.pluginRepo.create({
            slug: uniqueSlug,
            workflow: importData.workflow,
            status: PluginStatus.Draft,
            team: teamId
        });

        console.log(newPlugin, importData);

        let binaryImported = false;
        const binaryFile = directory.files.find((file) => file.path.startsWith('binary/'));
        if (binaryFile) {
            const binaryBuffer = await binaryFile.buffer();
            const binaryFileName = path.basename(binaryFile.path);
            const binaryObjectPath = `plugin-binaries/${newPlugin.id}/${v4()}-${binaryFileName}`;

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

            await this.pluginRepo.updateById(newPlugin.id, { workflow: newPlugin.props.workflow });

            logger.info(`@plugin-workflow-service: imported binary ${binaryObjectPath}`);
            binaryImported = true;
        }

        logger.info(`@plugin-storage-service: plugin imported ${newPlugin.id}`);
        return {
            plugin: newPlugin.props,
            binaryImported
        };
    }
};