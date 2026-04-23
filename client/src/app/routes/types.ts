import type { ComponentType } from 'react';

export type RouteLoader = () => Promise<{ default: ComponentType }>;

export enum DashboardNavigationSection {
    Main = 'main',
    Secondary = 'secondary',
    Settings = 'settings'
};

export enum DashboardNavigationIconKey {
    AI = 'ai',
    Containers = 'containers',
    Dashboard = 'dashboard',
    Import = 'import',
    Latex = 'latex',
    Messages = 'messages',
    MyTeam = 'my-team',
    Notebooks = 'notebooks',
    Plugins = 'plugins',
    SecretKeys = 'secret-keys',
    ManageRoles = 'manage-roles',
    Whiteboards = 'whiteboards'
};

export enum RoutePermissionMode {
    Any = 'any',
    All = 'all'
};

export interface RouteNavigationConfig {
    section: DashboardNavigationSection;
    label: string;
    icon?: DashboardNavigationIconKey;
    disabledReason?: string;
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
    navigation?: RouteNavigationConfig;
};

export interface RouteGroup {
    public: RouteConfig[];
    protected: RouteConfig[];
    guest: RouteConfig[];
    optionalAuth: RouteConfig[];
};
