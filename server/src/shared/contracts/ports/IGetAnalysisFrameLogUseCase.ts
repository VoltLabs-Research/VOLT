import type { IUseCase } from '@shared/application/IUseCase';
import type {
    GetAnalysisFrameLogInputDTO,
    GetAnalysisFrameLogOutputDTO
} from '@shared/contracts/dtos/GetAnalysisFrameLogDTO';

export interface IGetAnalysisFrameLogUseCase
    extends IUseCase<GetAnalysisFrameLogInputDTO, GetAnalysisFrameLogOutputDTO> {}
