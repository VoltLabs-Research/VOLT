import type { RevokeAllSessionsInputDTO, RevokeAllSessionsOutputDTO } from '@modules/session/dtos/RevokeAllSessionsDTO';
import type { ISessionRepository } from '@modules/session/ports/ISessionRepository';
import { SESSION_TOKENS } from '@modules/session/di/SessionTokens';
import type { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class RevokeAllSessionsUseCase implements IUseCase<RevokeAllSessionsInputDTO, RevokeAllSessionsOutputDTO>{
    constructor(
        @inject(SESSION_TOKENS.SessionRepository) private readonly sessionRepository: ISessionRepository
    ){}

    async execute(input: RevokeAllSessionsInputDTO): Promise<RevokeAllSessionsOutputDTO>{
        const revokedCount = await this.sessionRepository.deactivateAllExcept(
            input.userId,
            input.token
        );

        return { revokedCount };
    }
}
