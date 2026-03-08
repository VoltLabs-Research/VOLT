import type { PersistedEntity } from '@modules/team/domain/contracts/team/PersistedEntity';
import type { PaginatedResult, PaginationOptions } from '@shared/domain/port/IBaseRepository';

export interface TeamScopedInputDTO {
    teamId: string;
};

export interface TeamUserScopedInputDTO extends TeamScopedInputDTO {
    userId: string;
};

export interface PaginatedTeamScopedInputDTO extends TeamScopedInputDTO, PaginationOptions {};

export interface UserScopedInputDTO {
    userId: string;
};

export interface ProviderScopedInputDTO extends TeamScopedInputDTO {
    provider: string;
};

export type EntityIdInputDTO<TKey extends string> = {
    [Key in TKey]: string;
};

export type TeamScopedEntityIdInputDTO<TKey extends string> = TeamScopedInputDTO & EntityIdInputDTO<TKey>;

export type UserScopedEntityIdInputDTO<TKey extends string> = UserScopedInputDTO & EntityIdInputDTO<TKey>;

export type PersistedEntityDTO<TProps> = PersistedEntity<TProps>;

export type EntityOutputDTO<TProps> = PersistedEntityDTO<TProps>;

export type TeamScopedPaginatedOutputDTO<TData> = PaginatedOutputDTO<TData>;

export interface MessageOutputDTO {
    message: string;
};

export type EntityPropsOutputDTO<TProps> = PersistedEntityDTO<TProps>;

export type PaginatedOutputDTO<TData> = PaginatedResult<TData>;

export interface OperationSuccessDTO {
    success: boolean;
};
