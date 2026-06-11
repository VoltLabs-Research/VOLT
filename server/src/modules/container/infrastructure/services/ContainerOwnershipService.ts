import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import type { IContainerOwnershipService } from '@modules/container/domain/port/IContainerOwnershipService';
import type { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { ErrorCodes } from '@core/constants/error-codes';
import { Container } from '@modules/container/domain/entities/Container';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject } from 'tsyringe';

@Singleton(CONTAINER_TOKENS.ContainerOwnershipService)
export class ContainerOwnershipService implements IContainerOwnershipService {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRepository) private readonly repository: IContainerRepository
    ) {}

    async getOwnedByTeam(containerId: string, teamId: string): Promise<Container> {
        const container = await this.repository.findByIdOrFail(containerId);

        if (container.team?.toString() !== teamId) {
            throw new ApplicationError(ErrorCodes.TEAM_ACCESS_DENIED, 'Container does not belong to the requested team', 403);
        }

        return container;
    }
}
