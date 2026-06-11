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
}
