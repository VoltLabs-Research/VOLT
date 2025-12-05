import { Readable } from 'node:stream';

export type EntryType = 'file' | 'dir';

export interface FsEntry {
    type: EntryType;
    name: string;
    relPath: string;
    size?: number;
    mtime?: string;
    ext?: string | null;
    mime?: string | false;
};

export type Media = 'raster' | 'glb' | 'both';

export type VFSReadStream = {
    stream: Readable;
    size: number;
    contentType: string;
    filename: string;
};