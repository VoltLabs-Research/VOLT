export interface RouteConfig{
    path: string;
    component: React.ComponentType;
};

export interface RouteGroup{
    public: RouteConfig[];
    protected: RouteConfig[];
    guest: RouteConfig[];
};
