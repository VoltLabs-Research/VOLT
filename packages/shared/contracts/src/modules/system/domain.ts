

export interface RbacEntry{
    key: string;
    label: string;
}

export interface RbacConfig{
    resources: RbacEntry[];
    actions: RbacEntry[];
}

export interface SystemConfig{
    mode: 'local' | 'cloud';
}
