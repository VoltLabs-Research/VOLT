import { useMemo } from 'react';
import { container } from 'tsyringe';
import { JOBS_TOKENS } from '../../infrastructure/di/tokens';
import type IJobsRepository from '../../domain/ports/IJobsRepository';

const useJobsUseCases = () => {
    return useMemo(() => ({
        jobsRepository: container.resolve<IJobsRepository>(JOBS_TOKENS.JobsRepository)
    }), []);
};

export default useJobsUseCases;
