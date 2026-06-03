import Plugin, { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';

import { Readable } from 'node:stream';

export interface BinaryUploadResult {
    objectPath: string;
    fileName: string;
    size: number;
    binaryHash: string;
}

export interface BinaryUploadTarget extends BinaryUploadResult {
    uploadUrl: string;
    expiresAt: string;
}

export interface PluginImportResult {
    plugin: Plugin;
    binaryImported: boolean;
}

export interface IPluginStorageService {
    createBinaryUploadTarget(
        pluginId: string,
        teamId: string,
        input: {
            userId: string;
            fileName: string;
            size: number;
            contentType?: string;
            sha256?: string;
        }
    ): Promise<BinaryUploadTarget>;

    commitBinaryUpload(
        pluginId: string,
        teamId: string,
        input: {
            objectPath: string;
            fileName: string;
            size: number;
            sha256?: string;
        }
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
}
