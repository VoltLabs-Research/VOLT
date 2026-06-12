import type { PaginationOptions } from '@shared/domain/port/IBaseRepository';
import type { ListContainersOutputDTO as ListContainersOutputDTOContract } from '@shared/contracts/dtos/ListContainersDTO';
import type { Container } from '@modules/container/domain/entities/Container';

export interface ListContainersInputDTO extends Partial<PaginationOptions> {
    teamId: string;
    userId: string;
    folderId?: string;
    search?: string;
}

/**
 * The cross-consumed output shape now lives in the neutral contracts layer
 * (`@shared/contracts/dtos/ListContainersDTO`) for the detachable-modules
 * migration (the dashboard global-search consumes `['data']`). That DTO is
 * generic over the entity; this module binds it to the concrete `Container` and
 * re-exports so existing importers compile unchanged.
 */
export interface ListContainersOutputDTO extends ListContainersOutputDTOContract<Container> {}
