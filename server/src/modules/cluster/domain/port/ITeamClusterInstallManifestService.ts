import type {
    TeamClusterInstallManifestDTO,
    TeamClusterInstallManifestPortsDTO
} from '@modules/cluster/application/dtos/GenerateTeamClusterInstallManifestDTO';

export interface ITeamClusterInstallManifestService {
    generateInstallManifest(
        teamClusterId: string,
        daemonPassword: string,
        installRoot: string,
        ports: TeamClusterInstallManifestPortsDTO
    ): Promise<TeamClusterInstallManifestDTO>;
}
