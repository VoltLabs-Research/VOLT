import type {
    TeamClusterInstallManifestDTO,
    TeamClusterInstallManifestPortsDTO
} from '@modules/cluster/domain/contracts/TeamClusterInstallManifest';

export type {
    TeamClusterInstallManifestPortsDTO,
    TeamClusterInstallManifestFileDTO,
    TeamClusterInstallManifestImagesDTO,
    TeamClusterInstallManifestDTO
} from '@modules/cluster/domain/contracts/TeamClusterInstallManifest';

export interface GenerateTeamClusterInstallManifestInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    installRoot: string;
    ports: TeamClusterInstallManifestPortsDTO;
}

export interface GenerateTeamClusterInstallManifestOutputDTO {
    manifest: TeamClusterInstallManifestDTO;
}
