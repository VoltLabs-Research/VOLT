import { Tag } from '@voltstack/bravais';
import { formatDistanceToNow } from 'date-fns';
import type { KeyUsageMetricsRequest } from '@volt/contracts/modules/team/domain';

const STATUS_COLORS: Record<string, string> = {
    '2xx': 'var(--status-success)',
    '3xx': 'var(--accent-blue)',
    '4xx': 'var(--status-warning)',
    '5xx': 'var(--status-error)'
};

const METHOD_COLORS: Record<string, string> = {
    GET: 'var(--status-success)',
    POST: 'var(--accent-blue)',
    PUT: 'var(--accent-orange)',
    DELETE: 'var(--status-error)',
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
    <div className='x-auto' style={{ maxHeight: 250 }}>
        <table className='secret-key-page-table'>
            <thead>
                <tr>
                    <th>Method</th>
                    <th>Path</th>
                    <th>Status</th>
                    <th>Time</th>
                    <th>When</th>
                </tr>
            </thead>
            <tbody>
                {requests.map((request, index) => {
                    const methodColor = METHOD_COLORS[request.method] || 'var(--color-text-muted)';

                    return (
                        <tr key={index}>
                            <td>
                                <Tag
                                    size='xs'
                                    shape='square'
                                    className='font-mono font-weight-7'
                                    style={{
                                        color: methodColor,
                                        background: `color-mix(in srgb, ${methodColor} 12%, transparent)`
                                    }}
                                >
                                    {request.method}
                                </Tag>
                            </td>
                            <td className='font-mono font-size-1 color-secondary text-truncate' style={{ maxWidth: 200 }} title={request.path}>
                                {request.path}
                            </td>
                            <td>
                                <span style={{ color: STATUS_COLORS[getStatusColorGroup(request.statusCode)] || 'var(--color-text-muted)' }}>
                                    {request.statusCode}
                                </span>
                            </td>
                            <td className='font-mono font-size-1 color-muted'>
                                {request.responseTime.toFixed(0)}ms
                            </td>
                            <td className='font-size-1 color-muted'>
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
