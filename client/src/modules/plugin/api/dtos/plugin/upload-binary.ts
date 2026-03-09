export interface UploadBinaryInputDTO {
    pluginId: string;
    teamId: string;
    file: File;
    onProgress?: (progress: number) => void;
};

export interface UploadBinaryOutputDTO {
    objectPath: string;
    fileName: string;
    size: number;
};
