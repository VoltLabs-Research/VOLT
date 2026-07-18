import type { GetActiveSessionsInputDTO, GetActiveSessionsOutputDTO } from '@modules/session/dtos/GetActiveSessionsDTO';
import { toPersistedSessionDTO } from '@modules/session/dtos/PersistedSessionDTO';
import type { ISessionRepository } from '@modules/session/ports/ISessionRepository';
import { SESSION_TOKENS } from '@modules/session/di/SessionTokens';
import type { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class GetActiveSessionsUseCase implements IUseCase<GetActiveSessionsInputDTO, GetActiveSessionsOutputDTO[]>{
    constructor(
        @inject(SESSION_TOKENS.SessionRepository) private readonly sessionRepository: ISessionRepository
    ){}

    async execute(input: GetActiveSessionsInputDTO): Promise<GetActiveSessionsOutputDTO[]>{
        const sessions = await this.sessionRepository.findActiveByUserId(input.userId);
        return sessions.map((session) => toPersistedSessionDTO(session, input.token));
    }
}
