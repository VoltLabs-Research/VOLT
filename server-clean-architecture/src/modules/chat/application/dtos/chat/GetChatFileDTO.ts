import { Readable } from 'node:stream';

export interface GetChatFileInputDTO{
    filename: string;
};

export interface GetChatFileOutputDTO{
    stream: Readable;
    metadata: {
        contentType: string;
        size: number;
        disposition: 'inline' | 'attachment';
        filename?: string;
    };
}
