import {
    type TeamClusterServiceExposure
} from '@shared/contracts/types/TeamClusterExposure';
import type { ITeamClusterExposureRegistryService as ITeamClusterExposureRegistryServicePort } from '@shared/contracts/ports';
import { EventEmitter } from 'node:events';

interface ExposureRegistryChangeEvent {
    teamClusterId: string;
    exposures: TeamClusterServiceExposure[];
}

const buildRegistryKey = (teamClusterId: string, exposureId: string): string => {
    return `${teamClusterId}:${exposureId}`;
};

class TeamClusterExposureRegistryService implements ITeamClusterExposureRegistryServicePort {
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

    private emitChanged(teamClusterId: string): void {
        this.events.emit('changed', {
            teamClusterId,
            exposures: this.listTeamClusterExposures(teamClusterId)
        } satisfies ExposureRegistryChangeEvent);
    }
}

export default new TeamClusterExposureRegistryService();
