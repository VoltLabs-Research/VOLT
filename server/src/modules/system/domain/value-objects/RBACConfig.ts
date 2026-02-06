export interface RBACConfig {
    resources: RBACResource[];
    actions: RBACAction[];
}

export interface RBACResource {
    key: string;
    label: string;
}

export interface RBACAction {
    key: string;
    label: string;
}
