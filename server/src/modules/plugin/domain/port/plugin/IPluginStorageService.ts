import Plugin, { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';

import { Readable } from 'node:stream';

export interface PluginBinaryFile {
    buffer: Buffer;
    originalname?: string;
    originalName?: string;
    mimetype?: string;
    size: number;
};

export interface BinaryUploadResult{
    objectPath: string;
    fileName: string;
    size: number;
};

export interface PluginImportResult{
    plugin: Plugin;
    binaryImported: boolean;
};

export interface IPluginStorageService{
    /**
     * Upload a binary file for a plugin.
     */
    uploadBinary(
        pluginId: string,
        file: PluginBinaryFile
    ): Promise<BinaryUploadResult>;

    /**
     * Delete a plugin's binary from storage.
     */
    deleteBinary(
        pluginId: string,
    ): Promise<void>;

    /**
     * Export a plugin as a ZIP file streamed response.
     */
    exportPlugin(pluginId: string): Promise<Readable>;

    /**
     * Import a plugin from a ZIP file buffer.
     */
    importPlugin(
        fileBuffer: Buffer, 
        teamId: string,
        status?: PluginStatus
    ): Promise<PluginImportResult>;
};
