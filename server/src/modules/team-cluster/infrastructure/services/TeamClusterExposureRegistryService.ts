import { TeamClusterServiceExposureAccessMode, TeamClusterServiceExposureStatus, type TeamClusterServiceExposure } from '@modules/team-cluster/utilities/teamClusterSocket';
import { injectable } from 'tsyringe';
import { EventEmitter } from 'node:events';

interface ExposureRegistryChangeEvent {
    teamClusterId: string;
    exposures: TeamClusterServiceExposure[];
};

@injectable()
export default class TeamClusterExposureRegistryService {
    private readonly exposuresById = new Map<string, TeamClusterServiceExposure>();
    private readonly exposureIdsByTeamClusterId = new Map<string, Set<string>>();
    private readonly events = new EventEmitter();

    replaceTeamClusterExposures(teamClusterId: string, exposures: TeamClusterServiceExposure[]): void {
        this.clearTeamCluster(teamClusterId, false);

        const exposureIds = new Set<string>();
        for (const exposure of exposures) {
            this.exposuresById.set(exposure.id, exposure);
            exposureIds.add(exposure.id);
        }

        this.exposureIdsByTeamClusterId.set(teamClusterId, exposureIds);
        this.emitChanged(teamClusterId);
    }

    clearTeamCluster(teamClusterId: string, emitEvent: boolean = true): void {
        const exposureIds = this.exposureIdsByTeamClusterId.get(teamClusterId);
        if (exposureIds) {
            for (const exposureId of exposureIds) {
                this.exposuresById.delete(exposureId);
            }
        }

        this.exposureIdsByTeamClusterId.delete(teamClusterId);
        if (emitEvent) {
            this.emitChanged(teamClusterId);
        }
    }

    getExposure(exposureId: string): TeamClusterServiceExposure | null {
        return this.exposuresById.get(exposureId) || null;
    }

    listTeamClusterExposures(teamClusterId: string): TeamClusterServiceExposure[] {
        const exposureIds = this.exposureIdsByTeamClusterId.get(teamClusterId);
        if (!exposureIds) {
            return [];
        }

        const exposures: TeamClusterServiceExposure[] = [];
        for (const exposureId of exposureIds) {
            const exposure = this.exposuresById.get(exposureId);
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
        return Array.from(this.exposuresById.values()).filter((exposure) => {
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
