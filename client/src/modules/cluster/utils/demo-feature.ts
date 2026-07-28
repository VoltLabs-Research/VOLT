const truthy = (value: string | undefined): boolean => {
    if (!value) return false;
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

export const isDemoClusterFeatureEnabled = (): boolean => {
    return truthy(import.meta.env?.VITE_DEMO_CLUSTER_ENABLED as string | undefined);
};
