export interface AvailableClusterVersion {
    tag: string;
    publishedAt: string | null;
    isLatest: boolean;
    isEdge: boolean;
};

export interface FetchAvailableClusterVersionsInputDTO {
    teamId: string;
    teamClusterId: string;
};

export interface FetchAvailableClusterVersionsOutputDTO {
    versions: AvailableClusterVersion[];
};
