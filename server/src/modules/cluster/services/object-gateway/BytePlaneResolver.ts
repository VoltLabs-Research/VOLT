import { OBJECT_GATEWAY_EXPOSURE_ID } from '@modules/cluster/services/object-gateway/object-gateway-paths';
import teamClusterExposureRegistryService from '@modules/cluster/services/team-cluster/TeamClusterExposureRegistryService';
import logger from '@shared/infrastructure/logger';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';

export const OBJECT_GATEWAY_BASE_URL_LABEL = 'volt.exposure.base-url';

/*
 * How long a cluster stays on the tunnel after a direct dial failed. Short enough
 * that a daemon coming back does not stay demoted for a whole session, long enough
 * that a genuinely unroutable cluster is not re-probed once per object.
 */
const UNREACHABLE_TTL_MS = readPositiveIntegerEnv('TEAM_CLUSTER_BYTE_PLANE_UNREACHABLE_TTL_MS', 60_000);

const isDialableHttpUrl = (candidate: string): boolean => {
    try {
        const { protocol } = new URL(candidate);
        return protocol === 'http:' || protocol === 'https:';
    } catch {
        return false;
    }
};

/**
 * Decides whether a cluster's object bytes can travel over plain HTTP instead of
 * the daemon reverse channel.
 *
 * The reverse channel is a control connection: every object byte put on it is
 * framed, acked and relayed through the socket that also carries heartbeats and
 * container events. Where the daemon is routable from the server that detour buys
 * nothing, so the daemon advertises a base URL and reads go straight to it. The
 * tunnel stays as the answer for clusters that really are unreachable, which is
 * why a failed dial demotes rather than raises.
 */
class BytePlaneResolver {
    readonly #unreachableUntil = new Map<string, number>();

    /*
     * Reads are frequent, so "this cluster advertises no byte plane" is reported once
     * per cluster rather than per request. Without it the tunnel fallback is invisible
     * and a cluster silently running 100x slow looks like a cluster that is merely slow.
     */
    readonly #reportedMissingBaseUrl = new Set<string>();

    /** A dialable base URL for the cluster's object gateway, or null to tunnel. */
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

    /* Called when a direct dial failed before the gateway answered anything. */
    markUnreachable(teamClusterId: string, reason: string): void {
        if (!this.#unreachableUntil.has(teamClusterId)) {
            logger.warn(`[BytePlane] Falling back to the reverse channel teamClusterId=${teamClusterId} reason=${reason}`);
        }

        this.#unreachableUntil.set(teamClusterId, Date.now() + UNREACHABLE_TTL_MS);
    }

    /* A daemon reconnecting republishes its exposures, so stop punishing it. */
    clearTeamCluster(teamClusterId: string): void {
        this.#unreachableUntil.delete(teamClusterId);
        this.#reportedMissingBaseUrl.delete(teamClusterId);
    }
}

export default new BytePlaneResolver();
