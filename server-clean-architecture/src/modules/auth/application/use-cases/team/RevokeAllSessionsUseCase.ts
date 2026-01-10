import { IUseCase } from "../../../../../shared/application/IUseCase";
import { Result } from "../../../../../shared/domain/Result";
import ApplicationError from "../../../../../shared/application/errors/ApplicationErrors";
import { RevokeAllSessionsInputDTO, RevokeAllSessionsOutputDTO } from "../../dtos/session/RevokeAllSessionsDTo";
import { ISessionRepository } from "../../../domain/ports/ISessionRepository";

export default class RevokeAllSessionsUseCase implements IUseCase<RevokeAllSessionsInputDTO, RevokeAllSessionsOutputDTO, ApplicationError>{
    constructor(
        private readonly sessionRepository: ISessionRepository
    ){}

    async execute(input: RevokeAllSessionsInputDTO): Promise<Result<RevokeAllSessionsOutputDTO, ApplicationError>>{
        const revokedCount = await this.sessionRepository.deactivateAllExcept(
            input.userId,
            input.currentSessionId
        );

        return Result.ok({ revokedCount });
    }
};