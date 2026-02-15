export interface RouteConfig{
    path: string;
    component: React.ComponentType;
    index?: boolean;
    children?: RouteConfig[];

};

export interface RouteGroup{
    public: RouteConfig[];
    protected: RouteConfig[];
    guest: RouteConfig[];
    dashboardLayout?: React.ComponentType;
};
