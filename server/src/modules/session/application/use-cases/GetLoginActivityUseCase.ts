import type { GetLoginActivityInputDTO, GetLoginActivityOutputDTO } from '@modules/session/application/dtos/GetLoginActivityDTO';
import { toPersistedSessionDTO } from '@modules/session/application/dtos/PersistedSessionDTO';
import SessionRepository from '@modules/session/infrastructure/persistence/mongo/repositories/SessionRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class GetLoginActivityUseCase implements IUseCase<GetLoginActivityInputDTO, GetLoginActivityOutputDTO, ApplicationError>{
    constructor(
        
        private readonly sessionRepository: SessionRepository
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
