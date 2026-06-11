import type {
    TeamClusterInstallManifestDTO,
    TeamClusterInstallManifestPortsDTO
} from '@modules/cluster/domain/contracts/TeamClusterInstallManifest';

export interface ITeamClusterInstallManifestService {
    generateInstallManifest(
        teamClusterId: string,
        daemonPassword: string,
        installRoot: string,
        ports: TeamClusterInstallManifestPortsDTO
    ): Promise<TeamClusterInstallManifestDTO>;
}
