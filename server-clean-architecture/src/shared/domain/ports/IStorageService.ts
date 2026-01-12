import { Readable } from 'node:stream';

export type UploadSource = string | Buffer | Readable;

export interface FileMetadata{
    size: number;
    mimetype?: string;
    etag?: string;
    lastModified?: Date;
    [key: string]: any;
};

export interface IStorageService{
    upload(
        bucket: string,
        objectName: string,
        source: UploadSource,
        metadata?: Record<string, string>
    ): Promise<void>;

    listByPrefix(
        bucket: string,
        prefix: string,
        recursive?: boolean
    ): AsyncIterable<string>;

    getStream(
        bucket: string,
        objectName: string
    ): Promise<Readable>;

    getBuffer(
        bucket: string,
        objectName: string
    ): Promise<Buffer>;

    exists(
        bucket: string,
        objectName: string
    ): Promise<boolean>;

    delete(
        bucket: string,
        objectName: string
    ): Promise<void>;

    deleteByPrefix(
        bucket: string,
        prefix: string
    ): Promise<void>;

    getPublicURL(
        bucket: string,
        objectName: string
    ): string;

    getStat(
        bucket: string,
        objectName: string
    ): Promise<FileMetadata>;
};