import { resolveConfiguredRouteTitle } from '@/app/routes/metadata';

interface NavigationDestination {
    
    pathTemplate: string;
    
    requiredParams: string[];
    
    optionalParams?: string[];
    
    requiredPermissions?: string[];
    
    description: string;
}

const NAVIGATION_DESTINATIONS = {
    dashboard_home: {
        pathTemplate: '/dashboard',
        requiredParams: [],
        description: 'Dashboard home'
    },
    trajectories_list: {
        pathTemplate: '/dashboard/trajectories/list',
        requiredParams: [],
        description: 'Trajectories list'
    },
    trajectory_artifacts: {
        pathTemplate: '/dashboard/trajectories/artifacts',
        requiredParams: [],
        description: 'Trajectory artifacts'
    },
    trajectory_atoms: {
        pathTemplate: '/dashboard/trajectory/:trajectoryId/atoms',
        requiredParams: ['trajectoryId'],
        description: 'Per-atom data table for a trajectory'
    },
    simulation_cells: {
        pathTemplate: '/dashboard/simulation-cells/list',
        requiredParams: [],
        description: 'Simulation cells list'
    },
    analysis_configs: {
        pathTemplate: '/dashboard/analysis-configs/list',
        requiredParams: [],
        description: 'Analysis configurations'
    },
    analysis_sub_listings: {
        pathTemplate: '/dashboard/trajectory/:trajectoryId/analysis/:analysisId/sub-listings',
        requiredParams: ['trajectoryId', 'analysisId'],
        description: 'Sub-listings for an analysis run'
    },
    plugins_list: {
        pathTemplate: '/dashboard/plugins/list',
        requiredParams: [],
        description: 'Installed plugins'
    },
    plugin_builder: {
        pathTemplate: '/plugins/builder',
        requiredParams: [],
        description: 'Plugin builder'
    },
    plugin_exposure_listing: {
        pathTemplate: '/dashboard/plugins/:pluginId/exposure/:exposureId/listing',
        requiredParams: ['pluginId', 'exposureId'],
        description: 'A plugin exposure listing'
    },
    trajectory_plugin_exposure_listing: {
        pathTemplate: '/dashboard/trajectory/:trajectoryId/plugins/:pluginId/exposure/:exposureId/listing',
        requiredParams: ['trajectoryId', 'pluginId', 'exposureId'],
        description: 'Trajectory-scoped plugin exposure listing'
    },
    clusters_list: {
        pathTemplate: '/dashboard/clusters',
        requiredParams: [],
        description: 'Compute clusters'
    },
    cluster_monitoring: {
        pathTemplate: '/dashboard/clusters/:clusterId',
        requiredParams: ['clusterId'],
        description: 'Cluster monitoring'
    },
    containers_list: {
        pathTemplate: '/dashboard/containers',
        requiredParams: [],
        description: 'Containers'
    },
    container_create: {
        pathTemplate: '/dashboard/containers/new',
        requiredParams: [],
        description: 'Create a container'
    },
    container_details: {
        pathTemplate: '/dashboard/containers/:containerId',
        requiredParams: ['containerId'],
        description: 'Container details (append tab via query)'
    },
    messages: {
        pathTemplate: '/dashboard/messages',
        requiredParams: [],
        optionalParams: ['chatId'],
        description: 'Team messages'
    },
    ai_conversation: {
        pathTemplate: '/dashboard/ai',
        requiredParams: [],
        optionalParams: ['conversationId'],
        description: 'AI assistant page'
    },
    notebooks: {
        pathTemplate: '/dashboard/notebooks',
        requiredParams: [],
        description: 'Notebooks'
    },
    whiteboards: {
        pathTemplate: '/dashboard/whiteboards',
        requiredParams: [],
        description: 'Whiteboards'
    },
    whiteboard_editor: {
        pathTemplate: '/dashboard/whiteboard/:whiteboardId',
        requiredParams: ['whiteboardId'],
        description: 'Whiteboard editor'
    },
    my_team: {
        pathTemplate: '/dashboard/my-team',
        requiredParams: [],
        requiredPermissions: ['team:read'],
        description: 'My team'
    },
    manage_roles: {
        pathTemplate: '/dashboard/manage-roles',
        requiredParams: [],
        requiredPermissions: ['team-role:read'],
        description: 'Manage roles'
    },
    secret_keys: {
        pathTemplate: '/dashboard/secret-keys',
        requiredParams: [],
        requiredPermissions: ['team-secret-key:read'],
        description: 'Secret keys'
    },
    secret_key_metrics: {
        pathTemplate: '/dashboard/secret-keys/metrics',
        requiredParams: [],
        description: 'Secret key metrics'
    },
    settings_general: {
        pathTemplate: '/dashboard/settings/general',
        requiredParams: [],
        description: 'General settings'
    },
    settings_authentication: {
        pathTemplate: '/dashboard/settings/authentication',
        requiredParams: [],
        description: 'Authentication settings'
    },
    settings_theme: {
        pathTemplate: '/dashboard/settings/theme',
        requiredParams: [],
        description: 'Theme settings'
    },
    settings_integrations: {
        pathTemplate: '/dashboard/settings/integrations',
        requiredParams: [],
        description: 'Integrations settings (AI providers)'
    },
    settings_sessions: {
        pathTemplate: '/dashboard/settings/sessions',
        requiredParams: [],
        description: 'Session settings'
    }
} as const satisfies Record<string, NavigationDestination>;

type NavigationDestinationKey = keyof typeof NAVIGATION_DESTINATIONS;

const NAVIGATION_DESTINATION_KEYS = Object.keys(NAVIGATION_DESTINATIONS) as NavigationDestinationKey[];

interface ResolveDestinationResult {
    ok: boolean;
    path?: string;
    title?: string | null;
    error?: string;
}

const isKnownDestination = (key: string): key is NavigationDestinationKey => {
    return Object.prototype.hasOwnProperty.call(NAVIGATION_DESTINATIONS, key);
};

export const resolveDestination = (
    key: string,
    params: Record<string, string | undefined> = {},
    query: Record<string, string | undefined> = {}
): ResolveDestinationResult => {
    if (!isKnownDestination(key)) {
        return {
            ok: false,
            error: `Unknown destination "${key}". Allowed: ${NAVIGATION_DESTINATION_KEYS.join(', ')}`
        };
    }

    const destination = NAVIGATION_DESTINATIONS[key];

    const missing = destination.requiredParams.filter((name) => !params[name]);
    if (missing.length > 0) {
        return {
            ok: false,
            error: `Destination "${key}" requires params: ${missing.join(', ')}`
        };
    }

    let path: string = destination.pathTemplate;
    const optionalParams = (destination as NavigationDestination).optionalParams ?? [];
    const allParamNames = [...destination.requiredParams, ...optionalParams];
    for (const name of allParamNames) {
        const value = params[name];
        if (value === undefined) {
            continue;
        }
        path = path.replace(`:${name}`, encodeURIComponent(value));
    }

    if (path.includes('/:')) {
        return {
            ok: false,
            error: `Destination "${key}" has unresolved path params.`
        };
    }

    const queryEntries = Object.entries(query).filter(([, value]) => value !== undefined) as [string, string][];
    if (queryEntries.length > 0) {
        const search = new URLSearchParams(queryEntries).toString();
        path = `${path}?${search}`;
    }

    return {
        ok: true,
        path,
        title: resolveConfiguredRouteTitle(path.split('?')[0])
    };
};
