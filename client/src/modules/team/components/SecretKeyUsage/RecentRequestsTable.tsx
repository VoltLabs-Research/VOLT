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

interface RecentRequestsTableProps {
    requests: KeyUsageMetricsRequest[];
}

const RecentRequestsTable = ({ requests }: RecentRequestsTableProps) => (
    <div className='overflow-x-auto max-h-[250px]'>
        <table className='w-full border-collapse'>
            <thead>
                <tr>
                    <th className='px-4 py-3 text-left border-b border-border text-xs font-semibold uppercase tracking-[0.05em] text-muted'>Method</th>
                    <th className='px-4 py-3 text-left border-b border-border text-xs font-semibold uppercase tracking-[0.05em] text-muted'>Path</th>
                    <th className='px-4 py-3 text-left border-b border-border text-xs font-semibold uppercase tracking-[0.05em] text-muted'>Status</th>
                    <th className='px-4 py-3 text-left border-b border-border text-xs font-semibold uppercase tracking-[0.05em] text-muted'>Time</th>
                    <th className='px-4 py-3 text-left border-b border-border text-xs font-semibold uppercase tracking-[0.05em] text-muted'>When</th>
                </tr>
            </thead>
            <tbody>
                {requests.map((request, index) => {
                    const methodColor = METHOD_COLORS[request.method] || 'var(--muted)';

                    return (
                        <tr key={index} className='transition-colors hover:bg-surface-hover last:[&>td]:border-b-0'>
                            <td className='px-4 py-3 text-left border-b border-border text-sm'>
                                <span
                                    className='inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-transparent px-1.5 py-0.5 text-[0.65rem] font-medium leading-none font-mono'
                                    style={{
                                        color: methodColor,
                                        background: `color-mix(in srgb, ${methodColor} 12%, transparent)`
                                    }}
                                >
                                    {request.method}
                                </span>
                            </td>
                            <td className={cn('px-4 py-3 text-left border-b border-border text-sm', 'font-mono text-xs text-muted truncate max-w-[200px]')} title={request.path}>
                                {request.path}
                            </td>
                            <td className='px-4 py-3 text-left border-b border-border text-sm'>
                                <span style={{ color: STATUS_COLORS[getStatusColorGroup(request.statusCode)] || 'var(--muted)' }}>
                                    {request.statusCode}
                                </span>
                            </td>
                            <td className={cn('px-4 py-3 text-left border-b border-border text-sm', 'font-mono text-xs text-muted')}>
                                {request.responseTime.toFixed(0)}ms
                            </td>
                            <td className={cn('px-4 py-3 text-left border-b border-border text-sm', 'text-xs text-muted')}>
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
