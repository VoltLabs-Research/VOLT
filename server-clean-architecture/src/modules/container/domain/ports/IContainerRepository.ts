import { IBaseRepository } from '@/src/shared/domain/ports/IBaseRepository';
import { Container, IContainerProps } from '../entities/Container';

export interface IContainerRepository extends IBaseRepository<Container, IContainerProps> {
    deleteByTeamId(teamId: string): Promise<void>;
}
