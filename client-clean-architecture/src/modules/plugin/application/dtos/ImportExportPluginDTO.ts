import type { Plugin } from '../../domain/entities';

export interface ExportPluginInputDTO {
    id: string;
};

export type ExportPluginOutputDTO = Blob;

export interface ImportPluginInputDTO {
    file: File;
};

export type ImportPluginOutputDTO = Plugin;
