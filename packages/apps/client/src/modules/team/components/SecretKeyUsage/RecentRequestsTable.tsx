import { cn } from '@heroui/react';
import { formatDistanceToNow } from 'date-fns';
import { getStatusCodeClass } from '@/modules/team/utils/secret-key/chart-helpers';
import type { StatusCodeClass } from '@/modules/team/utils/secret-key/chart-helpers';
import type { KeyUsageMetricsRequest } from '@volt/contracts/modules/team/domain';
import Scrollable from '@/shared/ui/components/Scrollable';

const STATUS_CLASS_TONES: Record<StatusCodeClass, string> = {
    '2xx': 'text-success-soft-foreground',
    '3xx': 'text-foreground',
    '4xx': 'text-warning-soft-foreground',
    '5xx': 'text-danger-soft-foreground',
    other: 'text-muted'
};

const METHOD_TONES: Record<string, string> = {
    GET: 'bg-success-soft text-success-soft-foreground',
    POST: 'bg-foreground/8 text-foreground',
    PUT: 'bg-warning-soft text-warning-soft-foreground',
    DELETE: 'bg-danger-soft text-danger-soft-foreground',
    PATCH: 'bg-info-soft text-info-soft-foreground'
};

const COLUMNS = ['Method', 'Path', 'Status', 'Time', 'When'];

// The card's padding is the table's inset, so the outer columns sit flush with it.
const CELL_CLASS = 'p-3 text-left whitespace-nowrap first:ps-0 last:pe-0';

interface RecentRequestsTableProps {
    requests: KeyUsageMetricsRequest[];
}

const RecentRequestsTable = ({ requests }: RecentRequestsTableProps) => (
    <Scrollable orientation='horizontal' className='max-h-[250px]'>
        <table className='w-full min-w-[28rem] border-collapse text-sm'>
            <thead>
                <tr className='border-b border-separator'>
                    {COLUMNS.map((column) => (
                        <th scope='col' className={cn(CELL_CLASS, 'text-2xs font-semibold uppercase leading-none tracking-[0.05em] text-muted')} key={column}>
                            {column}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {requests.map((request, index) => (
                    <tr key={index} className='border-b border-separator last:border-b-0'>
                        <td className={CELL_CLASS}>
                            <span className={cn('inline-flex rounded-full px-2 py-0.5 font-mono text-2xs font-medium leading-none', METHOD_TONES[request.method] ?? 'bg-default text-muted')}>
                                {request.method}
                            </span>
                        </td>
                        <td className={cn(CELL_CLASS, 'max-w-[10rem] truncate font-mono text-xs text-muted')} title={request.path}>
                            {request.path}
                        </td>
                        <td className={cn(CELL_CLASS, 'tabular-nums', STATUS_CLASS_TONES[getStatusCodeClass(request.statusCode)])}>
                            {request.statusCode}
                        </td>
                        <td className={cn(CELL_CLASS, 'text-xs tabular-nums text-muted')}>
                            {request.responseTime.toFixed(0)}ms
                        </td>
                        <td className={cn(CELL_CLASS, 'text-xs text-muted')}>
                            {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </Scrollable>
);

export default RecentRequestsTable;
