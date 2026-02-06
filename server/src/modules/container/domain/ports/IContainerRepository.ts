import { IBaseRepository } from '@shared/domain/ports/IBaseRepository';
import { Container, IContainerProps } from '@modules/container/domain/entities/Container';

export interface IContainerRepository extends IBaseRepository<Container, IContainerProps> {
    deleteByTeamId(teamId: string): Promise<void>;
}
