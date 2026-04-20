import { ErrorCodes } from '@core/constants/error-codes';
import { SESSION_TOKENS } from '@modules/session/infrastructure/di/SessionTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { RevokeSessionInputDTO } from '@modules/session/application/dtos/RevokeSessionDTO';
import type { ISessionRepository } from '@modules/session/domain/port/ISessionRepository';
import type { IUseCase } from '@shared/application/IUseCase';

@injectable()
export default class RevokeSessionUseCase implements IUseCase<RevokeSessionInputDTO, void, ApplicationError>{
    constructor(
        @inject(SESSION_TOKENS.SessionRepository)
        private sessionRepository: ISessionRepository
    ){}

    async execute(input: RevokeSessionInputDTO): Promise<Result<void, ApplicationError>>{
        const session = await this.sessionRepository.findById(input.sessionId);
        if(!session){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.SESSION_NOT_FOUND,
                'Session not found'
            ));
        }

        if(session.props.user !== input.userId){
            return Result.fail(ApplicationError.forbidden(
                ErrorCodes.SESSION_REVOKE_FAILED,
                'You do not have permission to revoke this session'
            ));
        }

        await this.sessionRepository.updateById(input.sessionId, { isActive: false });
        return Result.ok(undefined);
    }
};
