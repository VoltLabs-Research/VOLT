import type { DaemonPaginatedResult } from '@modules/plugin/services/listing-row/DaemonListingMapper';
import { DAEMON_PAGE_SIZE } from '@modules/plugin/services/plugin/listing-constants';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';

/**
 * Exports need every row, but the daemon only ever answers one page, so the same
 * command is replayed with an increasing page number until the page count it
 * reports is exhausted.
 */
export const collectAllDaemonPages = async <TRow>(
    daemonClient: ITeamClusterDaemonClient,
    teamClusterId: string,
    command: string,
    payload: Record<string, unknown>
): Promise<TRow[]> => {
    const rows: TRow[] = [];
    let page = 1;
    let totalPages = 1;

    do {
        const daemonResult = await daemonClient.command<DaemonPaginatedResult<TRow>>(
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
