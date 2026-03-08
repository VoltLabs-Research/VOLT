interface UploadBinaryFile {
    buffer: Buffer;
    originalname?: string;
    originalName?: string;
    mimetype?: string;
    size: number;
};

export interface UploadBinaryInputDTO {
    pluginId: string;
    file: UploadBinaryFile;
};
