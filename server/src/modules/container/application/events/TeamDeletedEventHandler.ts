import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { DeleteManyOnTeamDeletedHandler } from '@shared/application/events/DeleteManyOnTeamDeletedHandler';
import { inject, injectable } from 'tsyringe';
import type { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';

@injectable()
export default class TeamDeletedEventHandler extends DeleteManyOnTeamDeletedHandler {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRepository)
        protected readonly repository: IContainerRepository
    ) {
        super();
    }
};
