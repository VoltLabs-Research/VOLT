import { ErrorCodes } from '@core/constants/error-codes';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { Container } from '@modules/container/domain/entities/Container';
import type { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';

@injectable()
export class ContainerOwnershipService {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRepository)
        private readonly repository: IContainerRepository
    ) {}

    async getOwnedByTeam(containerId: string, teamId: string): Promise<Container> {
        const container = await this.repository.findByIdOrFail(containerId);

        if (container.team?.toString() !== teamId) {
            throw new ApplicationError(ErrorCodes.TEAM_ACCESS_DENIED, 'Container does not belong to the requested team', 403);
        }

        return container;
    }
};
