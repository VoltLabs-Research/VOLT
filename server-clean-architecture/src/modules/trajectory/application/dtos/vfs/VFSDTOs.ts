// VFS DTOs
export interface ListVFSDirectoryInputDTO {
    trajectoryId: string;
    path?: string;
}

export interface ListVFSDirectoryOutputDTO {
    files: Array<{ name: string; type: 'file' | 'directory'; size?: number }>;
}

export interface GetVFSFileInputDTO {
    trajectoryId: string;
    path: string;
}

export interface UploadVFSFileInputDTO {
    trajectoryId: string;
    path: string;
    fileBuffer: Buffer;
}

export interface UploadVFSFileOutputDTO {
    message: string;
    path: string;
}

export interface DeleteVFSFileOutputDTO {
    message: string;
}

export interface DownloadVFSArchiveOutputDTO {
    stream: any;
    fileName: string;
}
