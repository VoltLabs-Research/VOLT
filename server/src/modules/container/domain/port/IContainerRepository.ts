/**
 * The canonical definition now lives in the neutral contracts layer
 * (`@shared/contracts/ports/IContainerRepository`) for the detachable-modules
 * migration. That port is generic over the entity/props; this module binds it to
 * the concrete `Container`/`IContainerProps` and re-exports so existing importers
 * of this module path compile unchanged.
 */
import type { IContainerRepository as IContainerRepositoryContract } from '@shared/contracts/ports/IContainerRepository';
import type { Container, IContainerProps } from '@modules/container/domain/entities/Container';

export type IContainerRepository = IContainerRepositoryContract<Container, IContainerProps>;
