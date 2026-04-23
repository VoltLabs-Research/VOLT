import type { GetActiveSessionsInputDTO, GetActiveSessionsOutputDTO } from '@modules/session/application/dtos/GetActiveSessionsDTO';
import { toPersistedSessionDTO } from '@modules/session/application/dtos/PersistedSessionDTO';
import SessionRepository from '@modules/session/infrastructure/persistence/mongo/repositories/SessionRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class GetActiveSessionsUseCase implements IUseCase<GetActiveSessionsInputDTO, GetActiveSessionsOutputDTO[], ApplicationError>{
    constructor(
        
        private sessionRepository: SessionRepository
    ){}

    async execute(input: GetActiveSessionsInputDTO): Promise<Result<GetActiveSessionsOutputDTO[], ApplicationError>>{
        const sessions = await this.sessionRepository.findActiveByUserId(input.userId);
        return Result.ok(sessions.map(toPersistedSessionDTO));
    }
};
