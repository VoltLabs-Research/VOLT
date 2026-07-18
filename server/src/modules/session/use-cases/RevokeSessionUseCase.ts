import { ErrorCodes } from '@core/constants/error-codes';
import type { RevokeSessionInputDTO } from '@modules/session/dtos/RevokeSessionDTO';
import type { ISessionRepository } from '@modules/session/ports/ISessionRepository';
import { SESSION_TOKENS } from '@modules/session/di/SessionTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class RevokeSessionUseCase implements IUseCase<RevokeSessionInputDTO, void>{
    constructor(
        @inject(SESSION_TOKENS.SessionRepository) private readonly sessionRepository: ISessionRepository
    ){}

    async execute(input: RevokeSessionInputDTO): Promise<void>{
        const session = await this.sessionRepository.findById(input.sessionId);
        if(!session){
            throw ApplicationError.notFound(
                ErrorCodes.SESSION_NOT_FOUND,
                'Session not found'
            );
        }

        if(session.props.user !== input.userId){
            throw ApplicationError.forbidden(
                ErrorCodes.SESSION_REVOKE_FAILED,
                'You do not have permission to revoke this session'
            );
        }

        await this.sessionRepository.updateById(input.sessionId, { isActive: false });
    }
}
