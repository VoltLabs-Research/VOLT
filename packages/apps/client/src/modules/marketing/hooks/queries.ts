import { buildKeys } from '@/shared/query/query-keys';
import { createQuery } from '@/shared/query/create-query';
import service from '../api/services/github-release-service';

const KEYS = buildKeys<{
    latestRelease: void;
}>('marketing');

export const latestDesktopReleaseQuery = createQuery(KEYS.latestRelease, () => service.getLatestRelease());
