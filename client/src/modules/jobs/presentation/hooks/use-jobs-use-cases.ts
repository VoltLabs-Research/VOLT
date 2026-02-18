import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { JOBS_TOKENS } from '../../infrastructure/di/tokens';
import type IJobsRepository from '../../domain/ports/IJobsRepository';

const useJobsUseCases = createUseCasesHook({
    jobsRepository: JOBS_TOKENS.JobsRepository
}) as () => {
    jobsRepository: IJobsRepository;
};

export default useJobsUseCases;
