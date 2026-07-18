export interface UploadBinaryInputDTO {
    pluginId: string;
    teamId: string;
    userId: string;
    fileName: string;
    size: number;
    type?: string;
    sha256?: string;
}

export interface CommitBinaryUploadInputDTO {
    pluginId: string;
    teamId: string;
    userId: string;
    objectPath: string;
    fileName: string;
    size: number;
    sha256?: string;
}
