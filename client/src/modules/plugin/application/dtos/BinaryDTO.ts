export interface UploadBinaryInputDTO {
    pluginId: string;
    file: File;
    onProgress?: (progress: number) => void;
};

export interface UploadBinaryOutputDTO {
    objectPath: string;
    fileName: string;
    size: number;
};

export interface DeleteBinaryInputDTO {
    pluginId: string;
};
