import type { RevokeAllSessionsInputDTO, RevokeAllSessionsOutputDTO } from '@modules/session/application/dtos/RevokeAllSessionsDTO';
import SessionRepository from '@modules/session/infrastructure/persistence/mongo/repositories/SessionRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class RevokeAllSessionsUseCase implements IUseCase<RevokeAllSessionsInputDTO, RevokeAllSessionsOutputDTO, ApplicationError>{
    constructor(
        private readonly sessionRepository: SessionRepository
    ){}

    async execute(input: RevokeAllSessionsInputDTO): Promise<Result<RevokeAllSessionsOutputDTO, ApplicationError>>{
        const revokedCount = await this.sessionRepository.deactivateAllExcept(
            input.userId,
            input.token
        );

        return Result.ok({ revokedCount });
    }
}
