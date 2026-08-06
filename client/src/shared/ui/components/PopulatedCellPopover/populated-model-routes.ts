
const populatedModelRoutes: Record<string, string> = {
    User: '/dashboard/my-team',
    TeamCluster: '/dashboard/clusters',
    Trajectory: '/dashboard/trajectories/list',
    Analysis: '/dashboard/analysis-configs/list',
    Plugin: '/dashboard/plugins/list',
    Container: '/dashboard/containers',
    ScriptingNotebook: '/dashboard/notebooks',
    Whiteboard: '/dashboard/whiteboards',
    SecretKey: '/dashboard/secret-keys'
};

export const getModelListingRoute = (modelName: string): string | null => {
    return populatedModelRoutes[modelName] ?? null;
};
