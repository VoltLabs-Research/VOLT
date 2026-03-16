import type { ComponentType } from 'react';

export type RouteLoader = () => Promise<{ default: ComponentType }>;

export enum RoutePermissionMode {
    Any = 'any',
    All = 'all'
};

export interface RouteConfig {
    path: string;
    title?: string;
    component?: ComponentType;
    loader?: RouteLoader;
    index?: boolean;
    children?: RouteConfig[];
    requiredPermissions?: string[];
    permissionMode?: RoutePermissionMode;
};

export interface RouteGroup {
    public: RouteConfig[];
    protected: RouteConfig[];
    guest: RouteConfig[];
    dashboardLayout?: ComponentType;
};
