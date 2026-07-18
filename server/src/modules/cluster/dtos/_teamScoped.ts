import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

// Local shim for the team-scoped marker types the deleted `team/dtos/common`
// used to export. Temporary — this whole dtos/ folder is being folded into
// ClusterService per the pollium conversion; deleted along with it.
export interface TeamScopedInputDTO {
    teamId: string;
}

export interface TeamUserScopedInputDTO extends TeamScopedInputDTO {
    userId: string;
}

export type EntityIdInputDTO<TKey extends string> = {
    [Key in TKey]: string;
};

export type TeamScopedEntityIdInputDTO<TKey extends string> = TeamScopedInputDTO & EntityIdInputDTO<TKey>;

export type TeamUserScopedEntityIdInputDTO<TKey extends string> = TeamUserScopedInputDTO & EntityIdInputDTO<TKey>;

export type PaginatedOutputDTO<TData> = PaginatedResult<TData>;

export interface OperationSuccessDTO {
    success: boolean;
}
