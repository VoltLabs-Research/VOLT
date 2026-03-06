import useResolve from '@/shared/presentation/hooks/use-resolve';
import { JOBS_TOKENS } from '../../infrastructure/di/tokens';
import type IJobsRepository from '../../domain/port/IJobsRepository';

const useJobsUseCases = () => {
    return {
        jobsRepository: useResolve<IJobsRepository>(JOBS_TOKENS.JobsRepository)
    };
};

export default useJobsUseCases;
