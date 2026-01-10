import { ISessionRepository } from "../../domain/ports/ISessionRepository";
import { Result } from "../../../../shared/domain/Result";
import ApplicationError from "../../../../shared/application/errors/ApplicationErrors";
import { IUseCase } from "../../../../shared/application/IUseCase";
import { GetActiveSessionsInputDTO, GetActiveSessionsOutputDTO } from "../dtos/GetActiveSessionsDTO";
import { SESSION_TOKENS } from "../../infrastructure/di/SessionTokens";
import { injectable, inject } from 'tsyringe';

@injectable()
export default class GetActiveSessionsUseCase implements IUseCase<GetActiveSessionsInputDTO, GetActiveSessionsOutputDTO[], ApplicationError>{
    constructor(
        @inject(SESSION_TOKENS.SessionRepository)
        private sessionRepository: ISessionRepository
    ){}

    async execute(input: GetActiveSessionsInputDTO): Promise<Result<GetActiveSessionsOutputDTO[], ApplicationError>>{
        const sessions = await this.sessionRepository.findActiveByUserId(input.userId);
        return Result.ok(sessions);   
    }
};