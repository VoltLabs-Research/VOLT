import type { IUseCase } from '@shared/application/IUseCase';
import type {
    GetAnalysisFrameLogInput,
    GetAnalysisFrameLogOutput
} from '@shared/contracts/operations/GetAnalysisFrameLog';

export interface IGetAnalysisFrameLogUseCase
    extends IUseCase<GetAnalysisFrameLogInput, GetAnalysisFrameLogOutput> {}
