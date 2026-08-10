import {
    SECRET_KEY_TABLE_CELL_CLASS,
    SECRET_KEY_TABLE_CLASS,
    SECRET_KEY_TABLE_HEAD_CELL_CLASS,
    SECRET_KEY_TABLE_ROW_CLASS
} from '@/modules/team/components/secret-key/shared/secret-key-page-styles';
import { cn } from '@heroui/react';
import { formatDistanceToNow } from 'date-fns';
import type { KeyUsageMetricsRequest } from '@volt/contracts/modules/team/domain';

const STATUS_COLORS: Record<string, string> = {
    '2xx': 'var(--success)',
    '3xx': 'var(--accent)',
    '4xx': 'var(--warning)',
    '5xx': 'var(--danger)'
};

const METHOD_COLORS: Record<string, string> = {
    GET: 'var(--success)',
    POST: 'var(--accent)',
    PUT: 'var(--warning)',
    DELETE: 'var(--danger)',
    PATCH: 'var(--accent-purple)'
};

const getStatusColorGroup = (code: number): string => {
    if (code >= 200 && code < 300) return '2xx';
    if (code >= 300 && code < 400) return '3xx';
    if (code >= 400 && code < 500) return '4xx';
    return '5xx';
};

/**
 * bravais's `Tag size='xs' shape='square'` — a 1px transparent border, `inline-flex`,
 * `gap-1`, `font-weight: 500`, `line-height: 1`, `white-space: nowrap`, `padding: 2px
 * 6px`, `font-size: 0.65rem` and `--radius-sm` (8px → `rounded-lg`).
 *
 * It stays a plain `<span>` rather than becoming a HeroUI `Chip`: the fill and the text
 * colour are computed per HTTP method at runtime, which is an inline style, not a
 * variant. `font-weight-7` was in the old class list and is defined nowhere, so the
 * base weight applies.
 */
const METHOD_TAG_CLASS = 'inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-transparent px-1.5 py-0.5 text-[0.65rem] font-medium leading-none font-mono';

interface RecentRequestsTableProps {
    requests: KeyUsageMetricsRequest[];
}

const RecentRequestsTable = ({ requests }: RecentRequestsTableProps) => (
    <div className='overflow-x-auto max-h-[250px]'>
        <table className={SECRET_KEY_TABLE_CLASS}>
            <thead>
                <tr>
                    <th className={SECRET_KEY_TABLE_HEAD_CELL_CLASS}>Method</th>
                    <th className={SECRET_KEY_TABLE_HEAD_CELL_CLASS}>Path</th>
                    <th className={SECRET_KEY_TABLE_HEAD_CELL_CLASS}>Status</th>
                    <th className={SECRET_KEY_TABLE_HEAD_CELL_CLASS}>Time</th>
                    <th className={SECRET_KEY_TABLE_HEAD_CELL_CLASS}>When</th>
                </tr>
            </thead>
            <tbody>
                {requests.map((request, index) => {
                    const methodColor = METHOD_COLORS[request.method] || 'var(--muted)';

                    return (
                        <tr key={index} className={SECRET_KEY_TABLE_ROW_CLASS}>
                            <td className={SECRET_KEY_TABLE_CELL_CLASS}>
                                <span
                                    className={METHOD_TAG_CLASS}
                                    style={{
                                        color: methodColor,
                                        background: `color-mix(in srgb, ${methodColor} 12%, transparent)`
                                    }}
                                >
                                    {request.method}
                                </span>
                            </td>
                            <td className={cn(SECRET_KEY_TABLE_CELL_CLASS, 'font-mono text-xs text-muted truncate max-w-[200px]')} title={request.path}>
                                {request.path}
                            </td>
                            <td className={SECRET_KEY_TABLE_CELL_CLASS}>
                                <span style={{ color: STATUS_COLORS[getStatusColorGroup(request.statusCode)] || 'var(--muted)' }}>
                                    {request.statusCode}
                                </span>
                            </td>
                            <td className={cn(SECRET_KEY_TABLE_CELL_CLASS, 'font-mono text-xs text-muted')}>
                                {request.responseTime.toFixed(0)}ms
                            </td>
                            <td className={cn(SECRET_KEY_TABLE_CELL_CLASS, 'text-xs text-muted')}>
                                {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
);

export default RecentRequestsTable;
