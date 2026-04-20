import { SESSION_TOKENS } from '@modules/session/infrastructure/di/SessionTokens';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { GetLoginActivityInputDTO, GetLoginActivityOutputDTO } from '@modules/session/application/dtos/GetLoginActivityDTO';
import { toPersistedSessionDTO } from '@modules/session/application/dtos/PersistedSessionDTO';
import type { ISessionRepository } from '@modules/session/domain/port/ISessionRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';

@injectable()
export default class GetLoginActivityUseCase implements IUseCase<GetLoginActivityInputDTO, GetLoginActivityOutputDTO, ApplicationError>{
    constructor(
        @inject(SESSION_TOKENS.SessionRepository)
        private readonly sessionRepository: ISessionRepository
    ){}

    async execute(input: GetLoginActivityInputDTO): Promise<Result<GetLoginActivityOutputDTO, ApplicationError>>{
        const sessions = await this.sessionRepository.findLoginActivity(input.userId, input.limit ?? 20);
        const activities = sessions.map(toPersistedSessionDTO);
        
        return Result.ok({
            activities,
            total: activities.length
        });
    }
};
