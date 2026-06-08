export interface TeamClusterDaemonRegistryInstallPayload {
    downloadUrl: string;
    sha256: string;
    fileName: string;
    name: string;
    version: string;
    platform: string;
}

export interface TeamClusterDaemonRegistryInstallBinary {
    objectPath: string;
    fileName: string;
    hash: string;
    sizeBytes: number;
}

export interface TeamClusterDaemonRegistryInstallResult {
    workflow: unknown;
    binary: TeamClusterDaemonRegistryInstallBinary;
    ownerClusterId: string;
}
