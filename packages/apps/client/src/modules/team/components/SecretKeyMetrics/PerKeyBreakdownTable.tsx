import { cn } from '@heroui/react';
import type { SecretKeyPerKeyMetric } from '@volt/contracts/modules/team/domain';
import Scrollable from '@/shared/ui/components/Scrollable';

interface PerKeyBreakdownTableProps {
    perKey: SecretKeyPerKeyMetric[];
}

const COLUMNS = ['Key', 'Role', 'Requests', 'Avg Response', 'Last Used', 'Status'];

// The card's padding is the table's inset, so the outer columns sit flush with it.
const CELL_CLASS = 'px-4 py-3 text-left whitespace-nowrap first:ps-0 last:pe-0';

const PerKeyBreakdownTable = ({ perKey }: PerKeyBreakdownTableProps) => (
    <section className='min-w-0 rounded-2xl bg-foreground/4 p-6 max-md:p-5'>
        <h2 className='mb-6 text-base font-semibold text-foreground'>Per-Key Breakdown</h2>
        <Scrollable orientation='horizontal'>
            <table className='w-full min-w-[40rem] border-collapse text-sm'>
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
                    {perKey.map((key) => (
                        <tr key={key.secretKeyId} className='border-b border-separator last:border-b-0'>
                            <td className={CELL_CLASS}>
                                <div className='flex flex-col'>
                                    <span className='font-medium text-foreground'>{key.name}</span>
                                    <span className='text-xs text-muted font-mono'>{key.keyPrefix}...</span>
                                </div>
                            </td>
                            <td className={cn(CELL_CLASS, 'text-muted')}>{key.roleName}</td>
                            <td className={cn(CELL_CLASS, 'tabular-nums text-foreground')}>{key.totalRequests.toLocaleString()}</td>
                            <td className={cn(CELL_CLASS, 'tabular-nums text-muted')}>{Math.round(key.avgResponseTime)} ms</td>
                            <td className={cn(CELL_CLASS, 'text-muted')}>
                                {key.lastRequestAt
                                    ? new Date(key.lastRequestAt).toLocaleDateString()
                                    : 'Never'}
                            </td>
                            <td className={cn(CELL_CLASS, key.isActive ? 'text-success-soft-foreground' : 'text-danger-soft-foreground')}>
                                {key.isActive ? 'Active' : 'Revoked'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Scrollable>
    </section>
);

export default PerKeyBreakdownTable;
