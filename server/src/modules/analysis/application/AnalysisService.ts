import type { DeleteAnalysisByIdInputDTO } from '@modules/analysis/application/dtos/DeleteAnalysisByIdDTO';
import type {
    GetAnalysesByTeamIdInputDTO,
    GetAnalysesByTeamIdOutputDTO
} from '@modules/analysis/application/dtos/GetAnalysesByTeamIdDTO';
import type {
    GetAnalysesByTrajectoryIdInputDTO,
    GetAnalysesByTrajectoryIdOutputDTO
} from '@modules/analysis/application/dtos/GetAnalysesByTrajectoryIdDTO';
import type {
    GetAnalysisByIdInputDTO,
    GetAnalysisByIdOutputDTO
} from '@modules/analysis/application/dtos/GetAnalysisByIdDTO';
import type {
    GetAnalysisFrameLogInputDTO,
    GetAnalysisFrameLogOutputDTO
} from '@modules/analysis/application/dtos/GetAnalysisFrameLogDTO';
import type {
    RetryFailedFramesInputDTO,
    RetryFailedFramesOutputDTO
} from '@modules/analysis/application/dtos/RetryFailedFramesDTO';
import DeleteAnalysisByIdUseCase from '@modules/analysis/application/use-cases/DeleteAnalysisByIdUseCase';
import GetAnalysesByTeamIdUseCase from '@modules/analysis/application/use-cases/GetAnalysesByTeamIdUseCase';
import { GetAnalysesByTrajectoryIdUseCase } from '@modules/analysis/application/use-cases/GetAnalysesByTrajectoryIdUseCase';
import GetAnalysisByIdUseCase from '@modules/analysis/application/use-cases/GetAnalysisByIdUseCase';
import GetAnalysisFrameLogUseCase from '@modules/analysis/application/use-cases/GetAnalysisFrameLogUseCase';
import RetryFailedFramesUseCase from '@modules/analysis/application/use-cases/RetryFailedFramesUseCase';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

interface DeleteAnalysisByIdOutputDTO {
    success: boolean;
}

/**
 * The single application service for the analysis module. One method per HTTP
 * operation. Every analysis use case is also consumed elsewhere — by the
 * analysis AI tools (`GetAnalysisByIdUseCase`, `GetAnalysesByTeamIdUseCase`,
 * `GetAnalysesByTrajectoryIdUseCase`, `RetryFailedFramesUseCase`,
 * `DeleteAnalysisByIdUseCase`, `GetAnalysisFrameLogUseCase`), by the
 * team/trajectory cascade-delete event handlers (`DeleteAnalysisByIdUseCase`),
 * and by the cross-module `IGetAnalysisFrameLogUseCase` contract port
 * (`GetAnalysisFrameLogUseCase`, aliased to
 * `COMPUTE_TOKENS.GetAnalysisFrameLogUseCase`). Each is therefore retained and
 * this service delegates to it, unwrapping the Result error channel onto thrown
 * `ApplicationError`s so Express 5 forwards them to the global error middleware.
 */
@Singleton(ANALYSIS_TOKENS.AnalysisService)
export default class AnalysisService {
    constructor(
        @inject(GetAnalysesByTeamIdUseCase) private readonly getAnalysesByTeamIdUseCase: GetAnalysesByTeamIdUseCase,
        @inject(GetAnalysesByTrajectoryIdUseCase) private readonly getAnalysesByTrajectoryIdUseCase: GetAnalysesByTrajectoryIdUseCase,
        @inject(GetAnalysisFrameLogUseCase) private readonly getAnalysisFrameLogUseCase: GetAnalysisFrameLogUseCase,
        @inject(RetryFailedFramesUseCase) private readonly retryFailedFramesUseCase: RetryFailedFramesUseCase,
        @inject(GetAnalysisByIdUseCase) private readonly getAnalysisByIdUseCase: GetAnalysisByIdUseCase,
        @inject(DeleteAnalysisByIdUseCase) private readonly deleteAnalysisByIdUseCase: DeleteAnalysisByIdUseCase
    ) {}

    async getAnalysesByTeamId(input: GetAnalysesByTeamIdInputDTO): Promise<GetAnalysesByTeamIdOutputDTO> {
        const result = await this.getAnalysesByTeamIdUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async getAnalysesByTrajectoryId(input: GetAnalysesByTrajectoryIdInputDTO): Promise<GetAnalysesByTrajectoryIdOutputDTO> {
        const result = await this.getAnalysesByTrajectoryIdUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async getAnalysisFrameLog(input: GetAnalysisFrameLogInputDTO): Promise<GetAnalysisFrameLogOutputDTO> {
        const result = await this.getAnalysisFrameLogUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async retryFailedFrames(input: RetryFailedFramesInputDTO): Promise<RetryFailedFramesOutputDTO> {
        const result = await this.retryFailedFramesUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async getAnalysisById(input: GetAnalysisByIdInputDTO): Promise<GetAnalysisByIdOutputDTO> {
        const result = await this.getAnalysisByIdUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async deleteAnalysisById(input: DeleteAnalysisByIdInputDTO): Promise<DeleteAnalysisByIdOutputDTO> {
        const result = await this.deleteAnalysisByIdUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }
}
