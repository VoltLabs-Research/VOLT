import { ISessionRepository } from "../../../domain/ports/ISessionRepository";
import { Result } from "../../../../../shared/domain/Result";
import ApplicationError from "../../../../../shared/application/errors/ApplicationErrors";
import { IUseCase } from "../../../../../shared/application/IUseCase";
import { GetActiveSessionsInputDTO, GetActiveSessionsOutputDTO } from "../../dtos/session/GetActiveSessionsDTO";

export default class GetActiveSessionsUseCase implements IUseCase<GetActiveSessionsInputDTO, GetActiveSessionsOutputDTO[], ApplicationError>{
    constructor(
        private sessionRepository: ISessionRepository
    ){}

    async execute(input: GetActiveSessionsInputDTO): Promise<Result<GetActiveSessionsOutputDTO[], ApplicationError>>{
        const sessions = await this.sessionRepository.findActiveByUserId(input.userId);
        return Result.ok(sessions);   
    }
};