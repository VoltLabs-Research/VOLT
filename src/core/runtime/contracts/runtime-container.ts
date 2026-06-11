export const VOLT_MANAGED_CONTAINER_LABEL_KEY = 'volt.managed';
export const VOLT_MANAGED_CONTAINER_LABEL_VALUE = 'true';
export const TEAM_ID_LABEL_KEY = 'volt.team.id';
export const TEAM_CLUSTER_ID_LABEL_KEY = 'volt.team-cluster.id';
export const HTTP_PORTS_LABEL_KEY = 'volt.exposure.http.ports';
export const WEBSOCKET_PORTS_LABEL_KEY = 'volt.exposure.websocket.ports';

/**
 * Optional readiness gating for an exposure. When a container declares
 * `volt.exposure.readiness.http.path`, the exposure registry probes
 * `http://<internalIp>:<port><path>[?<query>]` and only publishes the exposure
 * as `Active` once the probe returns a 2xx. Until then the exposure is
 * `Unavailable`. This lets services with asynchronous startup (e.g. a Jupyter
 * server) gate reachability without a bespoke runtime/RPC path. The probe port
 * defaults to the exposure's container port; `...readiness.http.port` overrides it.
 */
export const READINESS_HTTP_PATH_LABEL_KEY = 'volt.exposure.readiness.http.path';
export const READINESS_HTTP_QUERY_LABEL_KEY = 'volt.exposure.readiness.http.query';
export const READINESS_HTTP_PORT_LABEL_KEY = 'volt.exposure.readiness.http.port';

export const resolveComposeDefaultNetworkName = (composeProjectName?: string): string | undefined => {
    const normalizedComposeProjectName = composeProjectName?.trim();

    return normalizedComposeProjectName
        ? `${normalizedComposeProjectName}_default`
        : undefined;
};
