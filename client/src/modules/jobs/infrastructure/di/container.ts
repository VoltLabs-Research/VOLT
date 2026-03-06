import { container } from 'tsyringe';
import type IJobsRepository from '../../domain/port/IJobsRepository';
import JobsRepository from '../repositories/JobsRepository';
import { JOBS_TOKENS } from './tokens';

export const ensureJobsDI = (): void => {
    container.register<IJobsRepository>(JOBS_TOKENS.JobsRepository, JobsRepository);
};
