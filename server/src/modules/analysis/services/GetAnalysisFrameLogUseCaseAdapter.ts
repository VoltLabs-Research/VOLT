import AnalysisService from '@modules/analysis/services/AnalysisService';
import type { IGetAnalysisFrameLogUseCase } from '@shared/contracts/ports/IGetAnalysisFrameLogUseCase';
import type {
    GetAnalysisFrameLogInputDTO,
    GetAnalysisFrameLogOutputDTO
} from '@shared/contracts/dtos/GetAnalysisFrameLogDTO';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import { Singleton, AliasOf } from '@shared/infrastructure/di/decorators';

/**
 * Cross-module adapter registered under the neutral
 * `COMPUTE_TOKENS.GetAnalysisFrameLogUseCase` token so the trajectory
 * public-canvas use cases can read an analysis frame log without importing
 * `@modules/analysis`. Delegates to `new AnalysisService()` — the frame-log
 * logic itself lives on the service (pollium style), this only preserves the
 * `IGetAnalysisFrameLogUseCase.execute(...)` contract shape for the token.
 */
@Singleton()
@AliasOf(COMPUTE_TOKENS.GetAnalysisFrameLogUseCase)
export class GetAnalysisFrameLogUseCaseAdapter implements IGetAnalysisFrameLogUseCase {
    #service = new AnalysisService();

    async execute(input: GetAnalysisFrameLogInputDTO): Promise<GetAnalysisFrameLogOutputDTO> {
        return this.#service.getAnalysisFrameLog(input);
    }
}
