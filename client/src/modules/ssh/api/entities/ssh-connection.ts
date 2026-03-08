import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';

export interface SSHConnection extends BaseEntity {
    name: string;
    host: string;
    port: number;
    username: string;
    team: string;
    user: string;
};

export type FileEntryType = 'file' | 'dir';

export interface SSHFileEntry {
    type: FileEntryType;
    name: string;
    relPath: string;
    size?: number;
    mtime?: string;
};
