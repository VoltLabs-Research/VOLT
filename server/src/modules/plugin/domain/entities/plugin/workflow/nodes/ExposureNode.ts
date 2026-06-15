export interface ExposureProperty {
    key: string;
    label?: string;
    type?: string;
}

export interface ExposureNodeData {
    name: string;
    icon?: string;
    results: string;
    hasListing?: boolean;
    properties?: ExposureProperty[];
    // Optional stable key. When set (length >= 1), the pipeline registers this
    // exposure's output file path into ctx.sharedExposures[id] after the stage
    // runs, so a downstream plugin's inferFromContext argument with the same key
    // receives that path. Distinct from the projected `_id` (the workflow node id).
    id?: string;
}
