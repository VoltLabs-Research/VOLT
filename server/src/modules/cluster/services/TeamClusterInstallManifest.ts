export interface TeamClusterInstallManifestPortsView {
    minio: number;
    postgres: number;
    daemon: number;
}

export interface TeamClusterInstallManifestFileView {
    path: string;
    contents: string;
    mode: string;
}

export interface TeamClusterInstallManifestImagesView {
    minio: string;
    postgres: string;
    daemon: string;
}

export interface TeamClusterInstallManifestView {
    manifestVersion: string;
    composeProjectName: string;
    buildContextArchiveBase64?: string;
    files: TeamClusterInstallManifestFileView[];
    images: TeamClusterInstallManifestImagesView;
}
