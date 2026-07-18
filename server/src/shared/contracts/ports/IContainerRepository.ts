/**
 * Neutral, cross-module repository-port contract for the Container domain.
 * Extracted from `@modules/container/ports/IContainerRepository` during
 * the detachable-modules migration so consumers (dashboard, …) inject against a
 * contract rather than `@modules/container`.
 *
 * The container entity/props classes are NOT part of the neutral contracts
 * layer, so this port is GENERIC over them. The owner module re-exports a bound
 * alias so existing importers compile unchanged.
 */
import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';

export interface IContainerRepository<TContainer = unknown, TContainerProps = unknown>
    extends IBaseRepository<TContainer, TContainerProps> {
    findByIdOrFail(containerId: string): Promise<TContainer>;
    isPublicPortAssigned(publicPort: number, excludeContainerId?: string): Promise<boolean>;
    findWithPublicPorts(): Promise<TContainer[]>;
}
