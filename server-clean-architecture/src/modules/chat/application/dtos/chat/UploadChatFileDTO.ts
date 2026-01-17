export interface UploadChatFileInputDTO{
    buffer: Buffer;
    originalName: string;
    mimetype: string;
    size: number;
};

export interface UploadChatFileOutputDTO{
    filename: string;
    originalName: string;
    size: number;
    mimetype: string;
    url: string;
}
