import { useMemo } from 'react';
import { container } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';
import type ITrajectoryJobsRepository from '../../../domain/ports/ITrajectoryJobsRepository';

const useTrajectoryJobsUseCases = () => {
    return useMemo(() => ({
        trajectoryJobsRepository: container.resolve<ITrajectoryJobsRepository>(TRAJECTORY_TOKENS.TrajectoryJobsRepository)
    }), []);
};

export default useTrajectoryJobsUseCases;
