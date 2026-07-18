import type {
    TeamClusterInstallManifestDTO,
    TeamClusterInstallManifestPortsDTO
} from '@modules/cluster/contracts/TeamClusterInstallManifest';

export interface ITeamClusterInstallManifestService {
    generateInstallManifest(
        teamClusterId: string,
        daemonPassword: string,
        installRoot: string,
        ports: TeamClusterInstallManifestPortsDTO
    ): Promise<TeamClusterInstallManifestDTO>;
}
