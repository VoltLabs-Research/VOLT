import { Result } from "@/src/shared/domain/Result";
import { IUseCase } from "@/src/shared/application/IUseCase";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { injectable, inject } from 'tsyringe';
import { ANALYSIS_TOKENS } from "../../infrastructure/di/AnalysisTokens";
import { IAnalysisRepository } from "../../domain/port/IAnalysisRepository";
import { GetAnalysesByTeamIdInputDTO, GetAnalysesByTeamIdOutputDTO } from "../dtos/GetAnalysesByTeamIdDTO";

@injectable()
export default class GetAnalysesByTeamIdUseCase implements IUseCase<GetAnalysesByTeamIdInputDTO, GetAnalysesByTeamIdOutputDTO, ApplicationError>{
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private analysisRepo: IAnalysisRepository
    ){}

    async execute(input: GetAnalysesByTeamIdInputDTO): Promise<Result<GetAnalysesByTeamIdOutputDTO, ApplicationError>>{
        const { teamId } = input;
        const analysis = await this.analysisRepo.findAll({ filter: { team: teamId }, limit: 100, page: 1 });
        return Result.ok(analysis);
    }
};