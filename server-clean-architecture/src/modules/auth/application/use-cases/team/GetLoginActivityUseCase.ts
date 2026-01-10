import { IUseCase } from "../../../../../shared/application/IUseCase";
import { Result } from "../../../../../shared/domain/Result";
import ApplicationError from "../../../../../shared/application/errors/ApplicationErrors";
import { GetLoginActivityInputDTO, GetLoginActivityOutputDTO } from "../../dtos/session/GetLoginActivityDTO";
import { ISessionRepository } from "../../../domain/ports/ISessionRepository";

export default class GetLoginActivityUseCase implements IUseCase<GetLoginActivityInputDTO, GetLoginActivityOutputDTO, ApplicationError>{
    constructor(
        private readonly sessionRepository: ISessionRepository
    ){}

    async execute(input: GetLoginActivityInputDTO): Promise<Result<GetLoginActivityOutputDTO, ApplicationError>>{
        const sessions = await this.sessionRepository.findLoginActivity(input.userId, input.limit);
        
        return Result.ok({
            activites: sessions,
            total: sessions.length
        });
    }
};