import type {
    GetAnalysesInputDTO,
    GetAnalysesOutputDTO,
    GetAnalysesByTrajectoryInputDTO,
    GetAnalysesByTrajectoryOutputDTO,
    RetryFailedFramesOutputDTO
} from '../../application/dtos';

export default interface IAnalysisRepository {
    getAll(params: GetAnalysesInputDTO): Promise<GetAnalysesOutputDTO>;
    getByTrajectoryId(params: GetAnalysesByTrajectoryInputDTO): Promise<GetAnalysesByTrajectoryOutputDTO>;
    delete(id: string): Promise<void>;
    retryFailedFrames(id: string): Promise<RetryFailedFramesOutputDTO>;
};
