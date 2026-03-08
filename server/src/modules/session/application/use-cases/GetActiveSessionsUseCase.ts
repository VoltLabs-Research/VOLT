import { SESSION_TOKENS } from '@modules/session/infrastructure/di/SessionTokens';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { GetActiveSessionsInputDTO, GetActiveSessionsOutputDTO } from '@modules/session/application/dtos/GetActiveSessionsDTO';
import { toPersistedSessionDTO } from '@modules/session/application/dtos/PersistedSessionDTO';
import type { ISessionRepository } from '@modules/session/domain/port/ISessionRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationErrors';

@injectable()
export default class GetActiveSessionsUseCase implements IUseCase<GetActiveSessionsInputDTO, GetActiveSessionsOutputDTO[], ApplicationError>{
    constructor(
        @inject(SESSION_TOKENS.SessionRepository)
        private sessionRepository: ISessionRepository
    ){}

    async execute(input: GetActiveSessionsInputDTO): Promise<Result<GetActiveSessionsOutputDTO[], ApplicationError>>{
        const sessions = await this.sessionRepository.findActiveByUserId(input.userId);
        return Result.ok(sessions.map(toPersistedSessionDTO));
    }
};
