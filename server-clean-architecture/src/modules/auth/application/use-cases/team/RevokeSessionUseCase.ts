import { ISessionRepository } from "../../../domain/ports/ISessionRepository";
import { Result } from "../../../../../shared/domain/Result";
import ApplicationError from "../../../../../shared/application/errors/ApplicationErrors";
import { IUseCase } from "../../../../../shared/application/IUseCase";
import { ErrorCodes } from "../../../../../core/constants/error-codes";
import { RevokeSessionInputDTO } from "../../dtos/session/RevokeSessionDTO";

export default class RevokeSessionUseCase implements IUseCase<RevokeSessionInputDTO, void, ApplicationError>{
    constructor(
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