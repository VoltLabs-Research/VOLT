import type { DaemonPaginatedResult } from '@modules/plugin/services/listing-row/DaemonListingMapper';
import { DAEMON_PAGE_SIZE } from '@modules/plugin/services/plugin/listing-constants';
import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import type { DaemonCommand } from '@volt/contracts/modules/cluster/daemon-commands';

export const collectAllDaemonPages = async <TRow>(
    teamClusterId: string,
    command: DaemonCommand,
    payload: Record<string, unknown>
): Promise<TRow[]> => {
    const rows: TRow[] = [];
    let page = 1;
    let totalPages = 1;

    do {
        const daemonResult = await teamClusterDaemonClient.command<DaemonPaginatedResult<TRow>>(
            teamClusterId,
            command,
            {
                ...payload,
                page,
                limit: DAEMON_PAGE_SIZE
            }
        );

        rows.push(...daemonResult.data);
        totalPages = Math.max(1, daemonResult.totalPages || 1);
        page += 1;
    } while (page <= totalPages);

    return rows;
};
