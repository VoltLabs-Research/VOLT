import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type { Container, IContainerProps } from '@modules/container/domain/entities/Container';

export interface IContainerRepository extends IBaseRepository<Container, IContainerProps> {
    findByIdOrFail(containerId: string): Promise<Container>;
    isPublicPortAssigned(publicPort: number, excludeContainerId?: string): Promise<boolean>;
    findWithPublicPorts(): Promise<Container[]>;
}
