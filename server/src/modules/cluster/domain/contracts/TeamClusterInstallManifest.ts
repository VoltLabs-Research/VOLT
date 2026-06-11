/**
 * Team-cluster install-manifest domain vocabulary.
 *
 * Describes the install manifest the `ITeamClusterInstallManifestService`
 * domain port produces: the requested service ports, the generated files, the
 * pinned images and the assembled manifest. These are domain concepts the port
 * and its infrastructure builders share, so they live in the domain layer.
 *
 * The use-case input/output envelopes
 * (`GenerateTeamClusterInstallManifest{Input,Output}DTO`) remain in the
 * application layer, since those are application-orchestration shapes.
 */

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
