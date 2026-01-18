import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { RevokeAllSessionsInputDTO, RevokeAllSessionsOutputDTO } from '@modules/session/application/dtos/RevokeAllSessionsDTo';
import { ISessionRepository } from '@modules/session/domain/ports/ISessionRepository';
import { injectable, inject } from 'tsyringe';
import { SESSION_TOKENS } from '@modules/session/infrastructure/di/SessionTokens';

@injectable()
export default class RevokeAllSessionsUseCase implements IUseCase<RevokeAllSessionsInputDTO, RevokeAllSessionsOutputDTO, ApplicationError>{
    constructor(
        @inject(SESSION_TOKENS.SessionRepository)
        private readonly sessionRepository: ISessionRepository
    ){}

    async execute(input: RevokeAllSessionsInputDTO): Promise<Result<RevokeAllSessionsOutputDTO, ApplicationError>>{
        const revokedCount = await this.sessionRepository.deactivateAllExcept(
            input.userId,
            input.token
        );

        return Result.ok({ revokedCount });
    }
};