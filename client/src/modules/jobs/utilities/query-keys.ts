import { buildKeys } from '@/shared/infrastructure/query';

type TeamJobsQueryKeys = Record<'groups', void>;

export const TEAM_JOBS_QUERY_KEYS = buildKeys<TeamJobsQueryKeys>('team-jobs');
