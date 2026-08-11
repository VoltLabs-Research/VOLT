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
    MyTeam = 'my-team',
    Notebooks = 'notebooks',
    Plugins = 'plugins',
    ManageRoles = 'manage-roles',
    Whiteboards = 'whiteboards',

    SettingsGeneral = 'settings-general',
    SettingsAuthentication = 'settings-authentication',
    SettingsTheme = 'settings-theme',
    SettingsIntegrations = 'settings-integrations',
    SettingsSessions = 'settings-sessions',
    SecretKeys = 'secret-keys'
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
    multiTenantOnly?: boolean;
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
