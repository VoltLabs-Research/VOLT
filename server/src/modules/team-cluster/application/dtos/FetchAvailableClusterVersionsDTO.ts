import type { TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type FetchAvailableClusterVersionsInputDTO = TeamScopedEntityIdInputDTO<'teamClusterId'>;

export interface AvailableClusterVersionDTO {
    tag: string;
    publishedAt: string | null;
    isLatest: boolean;
    isEdge: boolean;
};

export interface FetchAvailableClusterVersionsOutputDTO {
    versions: AvailableClusterVersionDTO[];
};
