import type { IUseCase } from '@shared/application/IUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import type {
    GetAnalysisFrameLogInputDTO,
    GetAnalysisFrameLogOutputDTO
} from '@shared/contracts/dtos/GetAnalysisFrameLogDTO';

/**
 * Neutral port for the get-analysis-frame-log use case (detachable-modules
 * migration), so cross-module consumers (trajectory public-canvas) can inject
 * it by token against this interface without importing the concrete
 * `@modules/analysis` use-case class.
 */
export interface IGetAnalysisFrameLogUseCase
    extends IUseCase<GetAnalysisFrameLogInputDTO, GetAnalysisFrameLogOutputDTO, ApplicationError> {}
