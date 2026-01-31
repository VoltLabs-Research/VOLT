import { useMemo } from 'react';
import { container } from 'tsyringe';
import GetTrajectoriesUseCase from '../../../application/use-cases/trajectory/GetTrajectoriesUseCase';
import GetTrajectoryByIdUseCase from '../../../application/use-cases/trajectory/GetTrajectoryByIdUseCase';
import CreateTrajectoryUseCase from '../../../application/use-cases/trajectory/CreateTrajectoryUseCase';
import UpdateTrajectoryUseCase from '../../../application/use-cases/trajectory/UpdateTrajectoryUseCase';
import DeleteTrajectoryUseCase from '../../../application/use-cases/trajectory/DeleteTrajectoryUseCase';
import GetPreviewUseCase from '../../../application/use-cases/trajectory/GetPreviewUseCase';
import DownloadTrajectoryUseCase from '../../../application/use-cases/trajectory/DownloadTrajectoryUseCase';
import GetAtomsUseCase from '../../../application/use-cases/trajectory/GetAtomsUseCase';
import ListSamplesUseCase from '../../../application/use-cases/trajectory/ListSamplesUseCase';
import DownloadSampleUseCase from '../../../application/use-cases/trajectory/DownloadSampleUseCase';
import GetMetricsUseCase from '../../../application/use-cases/trajectory/GetMetricsUseCase';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';

const useTrajectoryUseCases = () => {
    return useMemo(() => ({
        getTrajectoriesUseCase: container.resolve<GetTrajectoriesUseCase>(TRAJECTORY_TOKENS.GetTrajectoriesUseCase),
        getTrajectoryByIdUseCase: container.resolve<GetTrajectoryByIdUseCase>(TRAJECTORY_TOKENS.GetTrajectoryByIdUseCase),
        createTrajectoryUseCase: container.resolve<CreateTrajectoryUseCase>(TRAJECTORY_TOKENS.CreateTrajectoryUseCase),
        updateTrajectoryUseCase: container.resolve<UpdateTrajectoryUseCase>(TRAJECTORY_TOKENS.UpdateTrajectoryUseCase),
        deleteTrajectoryUseCase: container.resolve<DeleteTrajectoryUseCase>(TRAJECTORY_TOKENS.DeleteTrajectoryUseCase),
        getPreviewUseCase: container.resolve<GetPreviewUseCase>(TRAJECTORY_TOKENS.GetPreviewUseCase),
        downloadTrajectoryUseCase: container.resolve<DownloadTrajectoryUseCase>(TRAJECTORY_TOKENS.DownloadTrajectoryUseCase),
        getAtomsUseCase: container.resolve<GetAtomsUseCase>(TRAJECTORY_TOKENS.GetAtomsUseCase),
        listSamplesUseCase: container.resolve<ListSamplesUseCase>(TRAJECTORY_TOKENS.ListSamplesUseCase),
        downloadSampleUseCase: container.resolve<DownloadSampleUseCase>(TRAJECTORY_TOKENS.DownloadSampleUseCase),
        getMetricsUseCase: container.resolve<GetMetricsUseCase>(TRAJECTORY_TOKENS.GetMetricsUseCase)
    }), []);
};

export default useTrajectoryUseCases;
