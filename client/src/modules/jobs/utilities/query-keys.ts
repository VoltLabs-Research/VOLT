import { buildKeys } from '@/shared/infrastructure/query';
import { registerPreservedQueryKey } from '@/shared/utils/app-cleanup-registry';

type TeamJobsQueryKeys = Record<'groups', void>;

export const TEAM_JOBS_QUERY_KEYS = buildKeys<TeamJobsQueryKeys>('team-jobs');

registerPreservedQueryKey(TEAM_JOBS_QUERY_KEYS.groups()[0] as string);
