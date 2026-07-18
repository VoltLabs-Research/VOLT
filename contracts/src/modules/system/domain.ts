// Wire response types for the system module — the shapes the client reads back
// from `data`.

export interface RbacEntry{
    key: string;
    label: string;
}

/** The RBAC vocabulary (resources + actions) the client renders permission UIs from. */
export interface RbacConfig{
    resources: RbacEntry[];
    actions: RbacEntry[];
}

/** Boot-time deployment configuration the client reads before authenticating. */
export interface SystemConfig{
    mode: 'local' | 'cloud';
    enabledModules: string[];
}
