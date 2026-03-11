export type RouteLoader = () => Promise<{ default: React.ComponentType }>;

export interface RouteConfig {
    path: string;
    component?: React.ComponentType;
    loader?: RouteLoader;
    index?: boolean;
    children?: RouteConfig[];
    requiredPermissions?: string[];
    permissionMode?: 'any' | 'all';
}

export interface RouteGroup {
    public: RouteConfig[];
    protected: RouteConfig[];
    guest: RouteConfig[];
    dashboardLayout?: React.ComponentType;
}
