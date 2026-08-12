import { cn } from '@heroui/react';
import type { SecretKeyPerKeyMetric } from '@volt/contracts/modules/team/domain';

interface PerKeyBreakdownTableProps {
    perKey: SecretKeyPerKeyMetric[];
}

const PerKeyBreakdownTable = ({ perKey }: PerKeyBreakdownTableProps) => (
    <div className='bg-surface border border-border p-6 rounded-xl'>
        <h3 className='text-base font-semibold text-foreground mb-6'>Per-Key Breakdown</h3>
        <div className='overflow-x-auto'>
            <table className='w-full border-collapse'>
                <thead>
                    <tr>
                        <th className='px-4 py-3 text-left border-b border-border text-xs font-semibold uppercase tracking-[0.05em] text-muted'>Key</th>
                        <th className='px-4 py-3 text-left border-b border-border text-xs font-semibold uppercase tracking-[0.05em] text-muted'>Role</th>
                        <th className='px-4 py-3 text-left border-b border-border text-xs font-semibold uppercase tracking-[0.05em] text-muted'>Requests</th>
                        <th className='px-4 py-3 text-left border-b border-border text-xs font-semibold uppercase tracking-[0.05em] text-muted'>Avg Response</th>
                        <th className='px-4 py-3 text-left border-b border-border text-xs font-semibold uppercase tracking-[0.05em] text-muted'>Last Used</th>
                        <th className='px-4 py-3 text-left border-b border-border text-xs font-semibold uppercase tracking-[0.05em] text-muted'>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {perKey.map((key) => (
                        <tr key={key.secretKeyId} className='transition-colors hover:bg-surface-hover last:[&>td]:border-b-0'>
                            <td className='px-4 py-3 text-left border-b border-border text-sm'>
                                <div className='flex flex-col'>
                                    <span className='font-medium text-foreground'>{key.name}</span>
                                    <span className='text-xs text-muted font-mono'>{key.keyPrefix}...</span>
                                </div>
                            </td>
                            <td className={cn('px-4 py-3 text-left border-b border-border text-sm', 'text-muted')}>{key.roleName}</td>
                            <td className={cn('px-4 py-3 text-left border-b border-border text-sm', 'font-mono text-foreground')}>{key.totalRequests.toLocaleString()}</td>
                            <td className={cn('px-4 py-3 text-left border-b border-border text-sm', 'font-mono text-muted')}>{Math.round(key.avgResponseTime)} ms</td>
                            <td className={cn('px-4 py-3 text-left border-b border-border text-sm', 'text-muted')}>
                                {key.lastRequestAt
                                    ? new Date(key.lastRequestAt).toLocaleDateString()
                                    : 'Never'}
                            </td>
                            <td className='px-4 py-3 text-left border-b border-border text-sm'>
                                <span className={key.isActive ? 'text-success' : 'text-danger'}>
                                    {key.isActive ? 'Active' : 'Revoked'}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

export default PerKeyBreakdownTable;
