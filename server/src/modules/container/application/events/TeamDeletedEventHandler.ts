import { injectable, inject } from 'tsyringe';
import { DeleteManyOnTeamDeletedHandler } from '@shared/application/events/DeleteManyOnTeamDeletedHandler';
import type { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';

@injectable()
export default class TeamDeletedEventHandler extends DeleteManyOnTeamDeletedHandler {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRepository)
        protected readonly repository: IContainerRepository
    ) {
        super();
    }
}
