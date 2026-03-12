/**
 * Maps populated model names to their corresponding listing routes.
 * Used by PopulatedCellPopover to render "View in listing" navigation links.
 */
export const populatedModelRoutes: Record<string, string> = {
    User: '/dashboard/my-team',
    TeamCluster: '/dashboard/clusters',
    Trajectory: '/dashboard/trajectories/list',
    Analysis: '/dashboard/analysis-configs/list',
    Plugin: '/dashboard/plugins/list',
    Container: '/dashboard/containers',
    ScriptingNotebook: '/dashboard/notebooks',
    LatexDocument: '/dashboard/latex',
    Whiteboard: '/dashboard/whiteboards',
    SecretKey: '/dashboard/secret-keys'
};

/**
 * Resolves the listing route for a given model name.
 *
 * @param modelName - The model/type name (e.g. 'User', 'Container').
 * @returns The listing route path, or null if no route is registered for the model.
 */
export const getModelListingRoute = (modelName: string): string | null => {
    return populatedModelRoutes[modelName] ?? null;
};
