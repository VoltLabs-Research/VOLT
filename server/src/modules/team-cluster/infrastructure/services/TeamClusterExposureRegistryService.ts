import { TeamClusterServiceExposureAccessMode, TeamClusterServiceExposureStatus, type TeamClusterServiceExposure } from '@modules/team-cluster/utilities/teamClusterSocket';
import { injectable } from 'tsyringe';
import { EventEmitter } from 'node:events';

interface ExposureRegistryChangeEvent {
    teamClusterId: string;
    exposures: TeamClusterServiceExposure[];
};

const buildRegistryKey = (teamClusterId: string, exposureId: string): string => {
    return `${teamClusterId}:${exposureId}`;
};

@injectable()
export default class TeamClusterExposureRegistryService {
    private readonly exposuresByRegistryKey = new Map<string, TeamClusterServiceExposure>();
    private readonly registryKeysByTeamClusterId = new Map<string, Set<string>>();
    private readonly events = new EventEmitter();

    replaceTeamClusterExposures(teamClusterId: string, exposures: TeamClusterServiceExposure[]): void {
        this.clearTeamCluster(teamClusterId, false);

        const registryKeys = new Set<string>();
        for (const exposure of exposures) {
            const registryKey = buildRegistryKey(teamClusterId, exposure.id);
            this.exposuresByRegistryKey.set(registryKey, exposure);
            registryKeys.add(registryKey);
        }

        this.registryKeysByTeamClusterId.set(teamClusterId, registryKeys);
        this.emitChanged(teamClusterId);
    }

    clearTeamCluster(teamClusterId: string, emitEvent: boolean = true): void {
        const registryKeys = this.registryKeysByTeamClusterId.get(teamClusterId);
        if (registryKeys) {
            for (const registryKey of registryKeys) {
                this.exposuresByRegistryKey.delete(registryKey);
            }
        }

        this.registryKeysByTeamClusterId.delete(teamClusterId);
        if (emitEvent) {
            this.emitChanged(teamClusterId);
        }
    }

    getTeamClusterExposure(teamClusterId: string, exposureId: string): TeamClusterServiceExposure | null {
        return this.exposuresByRegistryKey.get(buildRegistryKey(teamClusterId, exposureId)) || null;
    }

    listTeamClusterExposures(teamClusterId: string): TeamClusterServiceExposure[] {
        const registryKeys = this.registryKeysByTeamClusterId.get(teamClusterId);
        if (!registryKeys) {
            return [];
        }

        const exposures: TeamClusterServiceExposure[] = [];
        for (const registryKey of registryKeys) {
            const exposure = this.exposuresByRegistryKey.get(registryKey);
            if (exposure) {
                exposures.push(exposure);
            }
        }

        return exposures;
    }

    findTeamClusterExposure(
        teamClusterId: string,
        predicate: (exposure: TeamClusterServiceExposure) => boolean
    ): TeamClusterServiceExposure | null {
        const exposures = this.listTeamClusterExposures(teamClusterId);

        for (const exposure of exposures) {
            if (predicate(exposure)) {
                return exposure;
            }
        }

        return null;
    }

    listActiveTcpExposures(): TeamClusterServiceExposure[] {
        return Array.from(this.exposuresByRegistryKey.values()).filter((exposure) => {
            return exposure.status === TeamClusterServiceExposureStatus.Active
                && exposure.accessModes.includes(TeamClusterServiceExposureAccessMode.Tcp);
        });
    }

    onChanged(listener: (event: ExposureRegistryChangeEvent) => void): void {
        this.events.on('changed', listener);
    }

    offChanged(listener: (event: ExposureRegistryChangeEvent) => void): void {
        this.events.off('changed', listener);
    }

    private emitChanged(teamClusterId: string): void {
        this.events.emit('changed', {
            teamClusterId,
            exposures: this.listTeamClusterExposures(teamClusterId)
        } satisfies ExposureRegistryChangeEvent);
    }
};
