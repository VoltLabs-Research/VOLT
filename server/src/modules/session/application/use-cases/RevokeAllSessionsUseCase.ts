import { SESSION_TOKENS } from '@modules/session/infrastructure/di/SessionTokens';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { RevokeAllSessionsInputDTO, RevokeAllSessionsOutputDTO } from '@modules/session/application/dtos/RevokeAllSessionsDTO';
import type { ISessionRepository } from '@modules/session/domain/port/ISessionRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';

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
