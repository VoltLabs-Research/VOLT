export const VOLT_MANAGED_CONTAINER_LABEL_KEY = 'volt.managed';
export const VOLT_MANAGED_CONTAINER_LABEL_VALUE = 'true';
export const TEAM_ID_LABEL_KEY = 'volt.team.id';
export const TEAM_CLUSTER_ID_LABEL_KEY = 'volt.team-cluster.id';
export const HTTP_PORTS_LABEL_KEY = 'volt.exposure.http.ports';
export const WEBSOCKET_PORTS_LABEL_KEY = 'volt.exposure.websocket.ports';

export const resolveComposeDefaultNetworkName = (composeProjectName?: string): string | undefined => {
    const normalizedComposeProjectName = composeProjectName?.trim();

    return normalizedComposeProjectName
        ? `${normalizedComposeProjectName}_default`
        : undefined;
};
