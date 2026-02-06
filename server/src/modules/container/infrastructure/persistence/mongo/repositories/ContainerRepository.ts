import { injectable } from 'tsyringe';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { IContainerRepository } from '@modules/container/domain/ports/IContainerRepository';
import { ContainerModel, IContainer as IContainerDoc } from '@modules/container/infrastructure/persistence/mongo/models/ContainerModel';
import { Container, IContainerProps } from '@modules/container/domain/entities/Container';
import { ContainerMapper } from '@modules/container/infrastructure/persistence/mongo/mappers/ContainerMapper';

@injectable()
export class ContainerRepository extends MongooseBaseRepository<Container, IContainerProps, IContainerDoc> implements IContainerRepository {
    constructor() {
        super(ContainerModel, new ContainerMapper());
    }

    async deleteByTeamId(teamId: string): Promise<void> {
        await this.model.deleteMany({ team: teamId });
    }
}
