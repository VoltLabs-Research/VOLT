import { OBJECT_GATEWAY_EXPOSURE_ID } from '@modules/cluster/services/object-gateway/object-gateway-paths';
import teamClusterExposureRegistryService from '@modules/cluster/services/team-cluster/TeamClusterExposureRegistryService';
import logger from '@shared/infrastructure/logger';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';

export const OBJECT_GATEWAY_BASE_URL_LABEL = 'volt.exposure.base-url';

const UNREACHABLE_TTL_MS = readPositiveIntegerEnv('TEAM_CLUSTER_BYTE_PLANE_UNREACHABLE_TTL_MS', 60_000);

const isDialableHttpUrl = (candidate: string): boolean => {
    try {
        const { protocol } = new URL(candidate);
        return protocol === 'http:' || protocol === 'https:';
    } catch {
        return false;
    }
};

class BytePlaneResolver {
    readonly #unreachableUntil = new Map<string, number>();

    readonly #reportedMissingBaseUrl = new Set<string>();

    resolveBaseUrl(teamClusterId: string): string | null {
        const demotedUntil = this.#unreachableUntil.get(teamClusterId);
        if (demotedUntil !== undefined) {
            if (demotedUntil > Date.now()) {
                return null;
            }

            this.#unreachableUntil.delete(teamClusterId);
        }

        const exposure = teamClusterExposureRegistryService
            .listTeamClusterExposures(teamClusterId)
            .find((candidate) => candidate.id === OBJECT_GATEWAY_EXPOSURE_ID);

        const baseUrl = exposure?.labels?.[OBJECT_GATEWAY_BASE_URL_LABEL];
        if (!baseUrl) {
            if (!this.#reportedMissingBaseUrl.has(teamClusterId)) {
                this.#reportedMissingBaseUrl.add(teamClusterId);
                logger.info(
                    `[BytePlane] No direct object gateway advertised, reads will tunnel teamClusterId=${teamClusterId} exposureKnown=${Boolean(exposure)}`
                );
            }

            return null;
        }

        this.#reportedMissingBaseUrl.delete(teamClusterId);

        if (!isDialableHttpUrl(baseUrl)) {
            logger.warn(`[BytePlane] Ignoring unusable advertised base url teamClusterId=${teamClusterId} baseUrl=${baseUrl}`);
            return null;
        }

        return baseUrl;
    }

    markUnreachable(teamClusterId: string, reason: string): void {
        if (!this.#unreachableUntil.has(teamClusterId)) {
            logger.warn(`[BytePlane] Falling back to the reverse channel teamClusterId=${teamClusterId} reason=${reason}`);
        }

        this.#unreachableUntil.set(teamClusterId, Date.now() + UNREACHABLE_TTL_MS);
    }

    clearTeamCluster(teamClusterId: string): void {
        this.#unreachableUntil.delete(teamClusterId);
        this.#reportedMissingBaseUrl.delete(teamClusterId);
    }
}

export default new BytePlaneResolver();
