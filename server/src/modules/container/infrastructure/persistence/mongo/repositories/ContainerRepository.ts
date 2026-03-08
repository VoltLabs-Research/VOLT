import { Container, IContainerProps } from '@modules/container/domain/entities/Container';
import { ErrorCodes } from '@core/constants/error-codes';
import { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import { ContainerModel, IContainer as IContainerDoc } from '@modules/container/infrastructure/persistence/mongo/models/ContainerModel';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import containerMapper from '@modules/container/infrastructure/persistence/mongo/mappers/ContainerMapper';
import { injectable } from 'tsyringe';

@injectable()
export class ContainerRepository extends MongooseBaseRepository<Container, IContainerProps, IContainerDoc> implements IContainerRepository {
    constructor() {
        super(ContainerModel, containerMapper);
    }

    async deleteByTeamId(teamId: string): Promise<void> {
        await this.model.deleteMany({ team: teamId });
    }

    async findByIdOrFail(containerId: string): Promise<Container> {
        const container = await this.findById(containerId);
        if (!container) {
            throw new ApplicationError(ErrorCodes.CONTAINER_NOT_FOUND, 'Container not found', 404);
        }
        return container;
    }
};
