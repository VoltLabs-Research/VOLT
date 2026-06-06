export interface Page{
    title: string;
    path: string;
}

// Curated set of VOLT's navigable pages (static routes from the client's
// route definitions). The address bar also accepts any raw path, so anything
// not listed here is still reachable by typing it.
export const PAGES: Page[] = [
    { title: 'Dashboard',                path: '/dashboard' },
    { title: 'Containers',               path: '/dashboard/containers' },
    { title: 'Trajectories',             path: '/dashboard/trajectories/list' },
    { title: 'Trajectory Artifacts',     path: '/dashboard/trajectories/artifacts' },
    { title: 'Analysis Configurations',  path: '/dashboard/analysis-configs/list' },
    { title: 'Simulation Cells',         path: '/dashboard/simulation-cells/list' },
    { title: 'Plugins',                  path: '/dashboard/plugins/list' },
    { title: 'Notebooks',                path: '/dashboard/notebooks' },
    { title: 'LaTeX',                    path: '/dashboard/latex' },
    { title: 'Whiteboards',              path: '/dashboard/whiteboards' },
    { title: 'Clusters',                 path: '/dashboard/clusters' },
    { title: 'Volt AI',                  path: '/dashboard/ai' },
    { title: 'Messages',                 path: '/dashboard/messages' },
    { title: 'Secret Keys',              path: '/dashboard/secret-keys' },
    { title: 'My Team',                  path: '/dashboard/my-team' },
    { title: 'Manage Roles',             path: '/dashboard/manage-roles' },
    { title: 'General Settings',         path: '/dashboard/settings/general' },
    { title: 'Authentication',           path: '/dashboard/settings/authentication' },
    { title: 'Theme',                    path: '/dashboard/settings/theme' },
    { title: 'Integrations',             path: '/dashboard/settings/integrations' },
    { title: 'Sessions',                 path: '/dashboard/settings/sessions' }
];

export const pageTitleForPath = (path: string): string | null => {
    let best: Page | null = null;
    for(const page of PAGES){
        if(page.path === path) return page.title;
        if(path.startsWith(`${page.path}/`) && (!best || page.path.length > best.path.length)) best = page;
    }
    return best?.title ?? null;
};

export const searchPages = (query: string): Page[] => {
    const q = query.trim().toLowerCase();
    if(!q) return PAGES;
    return PAGES.filter((page) =>
        page.title.toLowerCase().includes(q) || page.path.toLowerCase().includes(q)
    );
};
