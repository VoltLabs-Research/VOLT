export interface RouteConfig {
    path: string;
    component: any;
    requiresLayout?: boolean;
    requiresSettingsLayout?: boolean;
}

export interface RouteGroup {
    public: RouteConfig[];
    protected: RouteConfig[];
    guest: RouteConfig[];
}
