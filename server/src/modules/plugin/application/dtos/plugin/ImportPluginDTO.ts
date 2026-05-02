import type { PersistedPluginDTO } from '@modules/plugin/application/dtos/plugin/PersistedPluginDTO';

interface ImportPluginFile {
    buffer: Buffer;
    originalname?: string;
    originalName?: string;
    mimetype?: string;
    size?: number;
}

export interface ImportPluginInputDTO {
    file: ImportPluginFile;
    teamId: string;
}

export interface ImportPluginOutputDTO extends PersistedPluginDTO { };
