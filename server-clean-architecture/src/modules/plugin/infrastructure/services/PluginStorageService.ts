import { BinaryUploadResult, IPluginStorageService, PluginImportResult } from '@modules/plugin/domain/ports/IPluginStorageService';
import { UpdatePluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/UpdatePluginByIdUseCase';
import { injectable, inject } from 'tsyringe';
import { PassThrough, Readable } from 'node:stream';
import { PluginStatus } from '@modules/plugin/domain/entities/Plugin';
import { ErrorCodes } from '@core/constants/error-codes';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IStorageService } from '@shared/domain/ports/IStorageService';
import { SYS_BUCKETS } from '@core/config/minio';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { v4 } from 'uuid';
import path from 'node:path';
import logger from '@shared/infrastructure/logger';
import archiver from 'archiver';
import unzipper from 'unzipper';

@injectable()
export default class PluginStorageService implements IPluginStorageService {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private pluginRepo: IPluginRepository,

        @inject(SHARED_TOKENS.StorageService)
        private storageService: IStorageService,

        @inject(UpdatePluginByIdUseCase)
        private updateByIdUseCase: UpdatePluginByIdUseCase
    ){}

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

        await this.updateByIdUseCase.execute({ pluginId, workflow: plugin.props.workflow.props });

        logger.info(`@plugin-storage-service: binary deleted: ${pathToDelete}`);
    }

    async uploadBinary(pluginId: string, file: any): Promise<BinaryUploadResult> {
        const plugin = await this.pluginRepo.findById(pluginId);
        if (!plugin) {
            throw new Error(ErrorCodes.PLUGIN_NOT_FOUND);
        }

        const originalName = file.originalname || file.originalName || 'binary';
        const fileExtension = path.extname(originalName) || '';
        const uniqueName = `${v4()}${fileExtension}`;
        const objectPath = `plugin-binaries/${pluginId}/${uniqueName}`;

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

        await this.updateByIdUseCase.execute({ pluginId, workflow: plugin.props.workflow.props });

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

    async importPlugin(fileBuffer: Buffer, teamId: string, status?: PluginStatus): Promise<PluginImportResult> {
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

        const originalSlug = importData.slug || 'plugin';
        const baseSlug = originalSlug.replace(/-[a-f0-9-]{8,}$/i, '').replace(/-\d{13,}$/, '');
        const uniqueSlug = `${baseSlug}-${teamId.slice(-6)}-${v4().slice(0, 8)}`;

        const workflow = importData.workflow;
        const idMap = new Map<string, string>();

        // First pass: collect all node IDs and generate new ones
        if (workflow.nodes && Array.isArray(workflow.nodes)) {
            for (const node of workflow.nodes) {
                const oldId = node.id;
                const newId = v4();
                idMap.set(oldId, newId);
            }
        }

        // Helper to replace ID references in strings (e.g., "{{ oldId.property }}")
        const replaceIdReferences = (obj: any): any => {
            if (typeof obj === 'string') {
                let result = obj;
                for (const [oldId, newId] of idMap.entries()) {
                    result = result.replace(new RegExp(oldId, 'g'), newId);
                }
                return result;
            }
            if (Array.isArray(obj)) {
                return obj.map(replaceIdReferences);
            }
            if (obj && typeof obj === 'object') {
                const newObj: any = {};
                for (const key of Object.keys(obj)) {
                    newObj[key] = replaceIdReferences(obj[key]);
                }
                return newObj;
            }
            return obj;
        };

        // Second pass: update node IDs and replace references in data
        if (workflow.nodes && Array.isArray(workflow.nodes)) {
            for (const node of workflow.nodes) {
                node.id = idMap.get(node.id) || node.id;
                node.data = replaceIdReferences(node.data);
            }
        }

        // Update edge IDs and references
        if (workflow.edges && Array.isArray(workflow.edges)) {
            for (const edge of workflow.edges) {
                edge.id = v4();
                if (idMap.has(edge.source)) {
                    edge.source = idMap.get(edge.source);
                }
                if (idMap.has(edge.target)) {
                    edge.target = idMap.get(edge.target);
                }
            }
        }

        const newPlugin = await this.pluginRepo.create({
            slug: uniqueSlug,
            workflow,
            status: status ?? PluginStatus.Draft,
            team: teamId
        });

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
            
            await this.updateByIdUseCase.execute({ pluginId: newPlugin.id, workflow: newPlugin.props.workflow.props, regenerateSlug: false });

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