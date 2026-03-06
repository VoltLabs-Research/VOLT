import { ISessionRepository } from '@modules/session/domain/port/ISessionRepository';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { GetActiveSessionsInputDTO, GetActiveSessionsOutputDTO } from '@modules/session/application/dtos/GetActiveSessionsDTO';
import { SESSION_TOKENS } from '@modules/session/infrastructure/di/SessionTokens';
import { injectable, inject } from 'tsyringe';

@injectable()
export default class GetActiveSessionsUseCase implements IUseCase<GetActiveSessionsInputDTO, GetActiveSessionsOutputDTO[], ApplicationError>{
    constructor(
        @inject(SESSION_TOKENS.SessionRepository)
        private sessionRepository: ISessionRepository
    ){}

    async execute(input: GetActiveSessionsInputDTO): Promise<Result<GetActiveSessionsOutputDTO[], ApplicationError>>{
        const sessions = await this.sessionRepository.findActiveByUserId(input.userId);
        return Result.ok(sessions);   
    }
};