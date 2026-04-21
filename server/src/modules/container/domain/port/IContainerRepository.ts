import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import { Container, IContainerProps } from '@modules/container/domain/entities/Container';

export interface IContainerRepository extends IBaseRepository<Container, IContainerProps> {
    findByIdOrFail(containerId: string): Promise<Container>;
};
