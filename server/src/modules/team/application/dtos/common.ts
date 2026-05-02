import type { PaginatedResult, PaginationOptions } from '@shared/domain/port/IBaseRepository';
import type { PersistedEntityOutput } from '@shared/domain/persisted/to-persisted-entity';

export interface TeamScopedInputDTO {
    teamId: string;
}

export interface TeamUserScopedInputDTO extends TeamScopedInputDTO {
    userId: string;
}

export interface PaginatedTeamScopedInputDTO extends TeamScopedInputDTO, PaginationOptions {}

export interface UserScopedInputDTO {
    userId: string;
}

export interface ProviderScopedInputDTO extends TeamScopedInputDTO {
    provider: string;
}

export type EntityIdInputDTO<TKey extends string> = {
    [Key in TKey]: string;
};

export type TeamScopedEntityIdInputDTO<TKey extends string> = TeamScopedInputDTO & EntityIdInputDTO<TKey>;

export type TeamUserScopedEntityIdInputDTO<TKey extends string> = TeamUserScopedInputDTO & EntityIdInputDTO<TKey>;

export type UserScopedEntityIdInputDTO<TKey extends string> = UserScopedInputDTO & EntityIdInputDTO<TKey>;

export type PersistedEntityDTO<TProps> = PersistedEntityOutput<TProps>;

export type EntityOutputDTO<TProps> = PersistedEntityDTO<TProps>;

export type TeamScopedPaginatedOutputDTO<TData> = PaginatedOutputDTO<TData>;

export interface MessageOutputDTO {
    message: string;
}

export type EntityPropsOutputDTO<TProps> = PersistedEntityDTO<TProps>;

export type PaginatedOutputDTO<TData> = PaginatedResult<TData>;

export interface OperationSuccessDTO {
    success: boolean;
}
