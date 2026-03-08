export interface RBACResourceDTO {
    key: string;
    label: string;
};

export interface RBACActionDTO {
    key: string;
    label: string;
};

export interface GetRBACConfigOutputDTO {
    resources: RBACResourceDTO[];
    actions: RBACActionDTO[];
};
