/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 * Plugin Storage Service - Handles binary upload/delete and plugin export/import
 */

import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import archiver from 'archiver';
import unzipper from 'unzipper';
import { Response } from 'express';
import { SYS_BUCKETS } from '@/config/minio';
import { IWorkflowNode, IPlugin } from '@/types/models/modifier';
import { NodeType, PluginStatus } from '@/types/models/plugin';
import { slugify } from '@/utilities/runtime/runtime';
import Plugin from '@/models/plugin';
import storage from '@/services/storage';
import logger from '@/logger';
import workflowValidator from '@/services/nodes/workflow-validator';

export interface BinaryUploadResult {
    objectPath: string;
    fileName: string;
    size: number;
}

export interface PluginImportResult {
    plugin: IPlugin;
    binaryImported: boolean;
}

class PluginStorageService {
    /**
     * Upload a binary file for a plugin
     */
    async uploadBinary(pluginId: string, file: Express.Multer.File): Promise<BinaryUploadResult> {
        const fileExtension = path.extname(file.originalname) || '';
        const uniqueName = `${uuidv4()}${fileExtension}`;
        const objectPath = `plugin-binaries/${pluginId}/${uniqueName}`;

        await storage.put(SYS_BUCKETS.PLUGINS, objectPath, file.buffer, {
            'Content-Type': file.mimetype || 'application/octet-stream',
            'x-amz-meta-original-name': file.originalname
        });

        // Update the plugin's entrypoint node with binary info
        const plugin = await Plugin.findById(pluginId);
        if (plugin?.workflow?.nodes) {
            const entrypointNode = plugin.workflow.nodes.find(
                (n: IWorkflowNode) => n.type === NodeType.ENTRYPOINT
            );
            if (entrypointNode?.data) {
                if (!entrypointNode.data.entrypoint) {
                    entrypointNode.data.entrypoint = {};
                }
                entrypointNode.data.entrypoint.binary = file.originalname;
                entrypointNode.data.entrypoint.binaryObjectPath = objectPath;
                entrypointNode.data.entrypoint.binaryFileName = file.originalname;
                plugin.markModified('workflow');
                await plugin.save();
            }
        }

        logger.info(`[PluginStorageService] Binary uploaded: ${objectPath} (${file.size} bytes)`);

        return {
            objectPath,
            fileName: file.originalname,
            size: file.size
        };
    }

    /**
     * Delete a plugin's binary from storage
     */
    async deleteBinary(plugin: IPlugin, objectPath?: string): Promise<void> {
        const entrypointNode = plugin.workflow?.nodes?.find(
            (n: IWorkflowNode) => n.type === NodeType.ENTRYPOINT
        );

        const pathToDelete = objectPath || entrypointNode?.data?.entrypoint?.binaryObjectPath;

        if (!pathToDelete) {
            throw new Error('Plugin::Binary::PathRequired');
        }

        if (!pathToDelete.toString().startsWith(`plugin-binaries/${plugin._id}/`)) {
            throw new Error('Plugin::Binary::InvalidPath');
        }

        await storage.delete(SYS_BUCKETS.PLUGINS, pathToDelete.toString());

        // Clear binary info from plugin if it was stored in DB
        if (entrypointNode?.data?.entrypoint?.binaryObjectPath) {
            entrypointNode.data.entrypoint.binaryObjectPath = undefined;
            entrypointNode.data.entrypoint.binaryFileName = undefined;
            entrypointNode.data.entrypoint.binary = undefined;
            plugin.markModified('workflow');
            await plugin.save();
        }

        logger.info(`[PluginStorageService] Binary deleted: ${pathToDelete}`);
    }

    /**
     * Export a plugin as a ZIP file streamed to response
     */
    async exportPlugin(plugin: IPlugin, res: Response): Promise<void> {
        const exportData = {
            slug: plugin.slug,
            workflow: plugin.workflow,
            status: PluginStatus.PUBLISHED,
            validated: plugin.validated,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };

        const entrypointNode = plugin.workflow?.nodes?.find(
            (n: IWorkflowNode) => n.type === NodeType.ENTRYPOINT
        );
        const binaryObjectPath = entrypointNode?.data?.entrypoint?.binaryObjectPath;
        const binaryFileName = entrypointNode?.data?.entrypoint?.binaryFileName || 'binary';

        const pluginName = slugify(plugin.slug);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${pluginName}.zip"`);

        const archive = archiver('zip', { zlib: { level: 5 } });
        archive.pipe(res);

        archive.append(JSON.stringify(exportData, null, 2), { name: 'plugin.json' });

        if (binaryObjectPath) {
            try {
                const binaryStream = await storage.getStream(SYS_BUCKETS.PLUGINS, binaryObjectPath);
                archive.append(binaryStream, { name: `binary/${binaryFileName}` });
            } catch (err) {
                logger.warn(`[PluginStorageService] Binary not found during export: ${binaryObjectPath}`);
            }
        }

        await archive.finalize();
    }

    /**
     * Import a plugin from a ZIP file buffer
     */
    async importPlugin(fileBuffer: Buffer, teamId: string): Promise<PluginImportResult> {
        const directory = await unzipper.Open.buffer(fileBuffer);

        const pluginJsonFile = directory.files.find((f: any) => f.path === 'plugin.json');
        if (!pluginJsonFile) {
            throw new Error('Plugin::Import::InvalidZip');
        }

        const pluginJsonBuffer = await pluginJsonFile.buffer();
        const importData = JSON.parse(pluginJsonBuffer.toString('utf-8'));

        if (!importData.workflow) {
            throw new Error('Plugin::Import::InvalidFormat');
        }

        const baseSlug = importData.slug || 'imported-plugin';
        const uniqueSlug = `${baseSlug}-${Date.now()}`;

        const newPlugin = await Plugin.create({
            slug: uniqueSlug,
            workflow: importData.workflow,
            status: PluginStatus.DRAFT,
            team: teamId
        });

        let binaryImported = false;
        const binaryFile = directory.files.find((f: any) => f.path.startsWith('binary/'));

        if (binaryFile) {
            const binaryBuffer = await binaryFile.buffer();
            const binaryFileName = path.basename(binaryFile.path);
            const binaryObjectPath = `plugin-binaries/${newPlugin._id}/${uuidv4()}-${binaryFileName}`;

            await storage.put(SYS_BUCKETS.PLUGINS, binaryObjectPath, binaryBuffer, {
                'Content-Type': 'application/octet-stream',
                'x-amz-meta-original-name': binaryFileName
            });

            const entrypointNode = newPlugin.workflow.nodes.find(
                (n: IWorkflowNode) => n.type === NodeType.ENTRYPOINT
            );

            if (entrypointNode?.data?.entrypoint) {
                entrypointNode.data.entrypoint.binaryObjectPath = binaryObjectPath;
                entrypointNode.data.entrypoint.binaryFileName = binaryFileName;
                newPlugin.markModified('workflow');
                await newPlugin.save();
            }

            logger.info(`[PluginStorageService] Imported binary: ${binaryObjectPath}`);
            binaryImported = true;
        }

        logger.info(`[PluginStorageService] Plugin imported: ${newPlugin.slug}`);
        return { plugin: newPlugin, binaryImported };
    }

    /**
     * Validate a plugin's workflow and publish it if valid.
     * Throws an error if validation fails.
     */
    async validateAndPublishPlugin(pluginId: string): Promise<IPlugin> {
        const plugin = await Plugin.findById(pluginId);
        if (!plugin) {
            throw new Error('Plugin::NotFound');
        }

        const { valid, errors } = workflowValidator.validateStructure(plugin.workflow);
        plugin.validated = valid;
        plugin.validationErrors = errors;

        if (!valid) {
            await plugin.save();
            throw new Error(`Plugin::ValidationFailed::${errors.join(', ')}`);
        }

        plugin.status = PluginStatus.PUBLISHED;
        await plugin.save();

        logger.info(`[PluginStorageService] Plugin validated and published: ${plugin.slug}`);
        return plugin;
    }
}

export default new PluginStorageService();
