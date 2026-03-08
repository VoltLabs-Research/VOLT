import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { GetLoginActivityInputDTO, GetLoginActivityOutputDTO } from '@modules/session/application/dtos/GetLoginActivityDTO';
import { ISessionRepository } from '@modules/session/domain/port/ISessionRepository';
import { injectable, inject } from 'tsyringe';
import { SESSION_TOKENS } from '@modules/session/infrastructure/di/SessionTokens';

@injectable()
export default class GetLoginActivityUseCase implements IUseCase<GetLoginActivityInputDTO, GetLoginActivityOutputDTO, ApplicationError>{
    constructor(
        @inject(SESSION_TOKENS.SessionRepository)
        private readonly sessionRepository: ISessionRepository
    ){}

    async execute(input: GetLoginActivityInputDTO): Promise<Result<GetLoginActivityOutputDTO, ApplicationError>>{
        const sessions = await this.sessionRepository.findLoginActivity(input.userId, input.limit ?? 20);
        
        return Result.ok({
            activities: sessions,
            total: sessions.length
        });
    }
};
