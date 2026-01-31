import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';
import type GetTrajectoriesUseCase from '../../../application/use-cases/trajectory/GetTrajectoriesUseCase';
import type GetTrajectoryByIdUseCase from '../../../application/use-cases/trajectory/GetTrajectoryByIdUseCase';
import type CreateTrajectoryUseCase from '../../../application/use-cases/trajectory/CreateTrajectoryUseCase';
import type UpdateTrajectoryUseCase from '../../../application/use-cases/trajectory/UpdateTrajectoryUseCase';
import type DeleteTrajectoryUseCase from '../../../application/use-cases/trajectory/DeleteTrajectoryUseCase';
import type GetPreviewUseCase from '../../../application/use-cases/trajectory/GetPreviewUseCase';
import type DownloadTrajectoryUseCase from '../../../application/use-cases/trajectory/DownloadTrajectoryUseCase';
import type GetAtomsUseCase from '../../../application/use-cases/trajectory/GetAtomsUseCase';
import type ListSamplesUseCase from '../../../application/use-cases/trajectory/ListSamplesUseCase';
import type DownloadSampleUseCase from '../../../application/use-cases/trajectory/DownloadSampleUseCase';
import type GetMetricsUseCase from '../../../application/use-cases/trajectory/GetMetricsUseCase';

const useTrajectoryUseCases = createUseCasesHook({
    getTrajectoriesUseCase: TRAJECTORY_TOKENS.GetTrajectoriesUseCase,
    getTrajectoryByIdUseCase: TRAJECTORY_TOKENS.GetTrajectoryByIdUseCase,
    createTrajectoryUseCase: TRAJECTORY_TOKENS.CreateTrajectoryUseCase,
    updateTrajectoryUseCase: TRAJECTORY_TOKENS.UpdateTrajectoryUseCase,
    deleteTrajectoryUseCase: TRAJECTORY_TOKENS.DeleteTrajectoryUseCase,
    getPreviewUseCase: TRAJECTORY_TOKENS.GetPreviewUseCase,
    downloadTrajectoryUseCase: TRAJECTORY_TOKENS.DownloadTrajectoryUseCase,
    getAtomsUseCase: TRAJECTORY_TOKENS.GetAtomsUseCase,
    listSamplesUseCase: TRAJECTORY_TOKENS.ListSamplesUseCase,
    downloadSampleUseCase: TRAJECTORY_TOKENS.DownloadSampleUseCase,
    getMetricsUseCase: TRAJECTORY_TOKENS.GetMetricsUseCase
}) as () => {
    getTrajectoriesUseCase: GetTrajectoriesUseCase;
    getTrajectoryByIdUseCase: GetTrajectoryByIdUseCase;
    createTrajectoryUseCase: CreateTrajectoryUseCase;
    updateTrajectoryUseCase: UpdateTrajectoryUseCase;
    deleteTrajectoryUseCase: DeleteTrajectoryUseCase;
    getPreviewUseCase: GetPreviewUseCase;
    downloadTrajectoryUseCase: DownloadTrajectoryUseCase;
    getAtomsUseCase: GetAtomsUseCase;
    listSamplesUseCase: ListSamplesUseCase;
    downloadSampleUseCase: DownloadSampleUseCase;
    getMetricsUseCase: GetMetricsUseCase;
};

export default useTrajectoryUseCases;
