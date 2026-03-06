import type { PaginatedResult, PaginationOptions } from '@shared/domain/port/IBaseRepository';
import type { Container } from '@modules/container/domain/entities/Container';

export interface ListContainersInputDTO extends Partial<PaginationOptions> {
    teamId: string;
    userId: string;
}

export interface ListContainersOutputDTO extends PaginatedResult<Container> {}
