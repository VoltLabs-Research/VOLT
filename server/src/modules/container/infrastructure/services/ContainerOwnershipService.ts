import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { ErrorCodes } from '@core/constants/error-codes';
import { Container } from '@modules/container/domain/entities/Container';
import { ContainerRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';

@Singleton(CONTAINER_TOKENS.ContainerOwnershipService)
export class ContainerOwnershipService {
    constructor(
        private readonly repository: ContainerRepository
    ) {}

    async getOwnedByTeam(containerId: string, teamId: string): Promise<Container> {
        const container = await this.repository.findByIdOrFail(containerId);

        if (container.team?.toString() !== teamId) {
            throw new ApplicationError(ErrorCodes.TEAM_ACCESS_DENIED, 'Container does not belong to the requested team', 403);
        }

        return container;
    }
}
