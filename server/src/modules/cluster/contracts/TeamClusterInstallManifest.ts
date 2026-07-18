

export interface TeamClusterInstallManifestPortsDTO {
    minio: number;
    redis: number;
    mongodb: number;
    daemon: number;
}

export interface TeamClusterInstallManifestFileDTO {
    path: string;
    contents: string;
    mode: string;
}

export interface TeamClusterInstallManifestImagesDTO {
    minio: string;
    redis: string;
    mongodb: string;
    daemon: string;
}

export interface TeamClusterInstallManifestDTO {
    manifestVersion: string;
    composeProjectName: string;
    buildContextArchiveBase64?: string;
    files: TeamClusterInstallManifestFileDTO[];
    images: TeamClusterInstallManifestImagesDTO;
}
