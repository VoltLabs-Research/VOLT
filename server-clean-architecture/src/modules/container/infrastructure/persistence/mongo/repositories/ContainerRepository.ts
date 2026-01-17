import { injectable } from 'tsyringe';
import { MongooseBaseRepository } from '@/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { IContainerRepository } from '@/src/modules/container/domain/ports/IContainerRepository';
import { ContainerModel, IContainer as IContainerDoc } from '../models/ContainerModel';
import { Container, IContainerProps } from '@/src/modules/container/domain/entities/Container';
import { ContainerMapper } from '../mappers/ContainerMapper';

@injectable()
export class ContainerRepository extends MongooseBaseRepository<Container, IContainerProps, IContainerDoc> implements IContainerRepository {
    constructor() {
        super(ContainerModel, new ContainerMapper());
    }

    async deleteByTeamId(teamId: string): Promise<void> {
        await this.model.deleteMany({ team: teamId });
    }
}
