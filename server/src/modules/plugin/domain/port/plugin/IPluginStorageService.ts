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
    uploadBinary(
        pluginId: string,
        teamId: string,
        file: PluginBinaryFile
    ): Promise<BinaryUploadResult>;

    deleteBinary(
        pluginId: string,
    ): Promise<void>;

    exportPlugin(pluginId: string): Promise<Readable>;

    importPlugin(
        fileBuffer: Buffer, 
        teamId: string,
        status?: PluginStatus
    ): Promise<PluginImportResult>;
};
