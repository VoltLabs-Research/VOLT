import {
    SECRET_KEY_TABLE_CELL_CLASS,
    SECRET_KEY_TABLE_CLASS,
    SECRET_KEY_TABLE_HEAD_CELL_CLASS,
    SECRET_KEY_TABLE_ROW_CLASS
} from '@/modules/team/components/secret-key/shared/secret-key-page-styles';
import { cn } from '@heroui/react';
import type { SecretKeyPerKeyMetric } from '@volt/contracts/modules/team/domain';

interface PerKeyBreakdownTableProps {
    perKey: SecretKeyPerKeyMetric[];
}

const PerKeyBreakdownTable = ({ perKey }: PerKeyBreakdownTableProps) => (
    <div className='bg-surface border border-border p-6 rounded-2xl'>
        <h3 className='text-base font-semibold text-foreground mb-6'>Per-Key Breakdown</h3>
        <div className='overflow-x-auto'>
            <table className={SECRET_KEY_TABLE_CLASS}>
                <thead>
                    <tr>
                        <th className={SECRET_KEY_TABLE_HEAD_CELL_CLASS}>Key</th>
                        <th className={SECRET_KEY_TABLE_HEAD_CELL_CLASS}>Role</th>
                        <th className={SECRET_KEY_TABLE_HEAD_CELL_CLASS}>Requests</th>
                        <th className={SECRET_KEY_TABLE_HEAD_CELL_CLASS}>Avg Response</th>
                        <th className={SECRET_KEY_TABLE_HEAD_CELL_CLASS}>Last Used</th>
                        <th className={SECRET_KEY_TABLE_HEAD_CELL_CLASS}>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {perKey.map((key) => (
                        <tr key={key.secretKeyId} className={SECRET_KEY_TABLE_ROW_CLASS}>
                            <td className={SECRET_KEY_TABLE_CELL_CLASS}>
                                <div className='flex flex-col'>
                                    <span className='font-medium text-foreground'>{key.name}</span>
                                    <span className='text-xs text-muted font-mono'>{key.keyPrefix}...</span>
                                </div>
                            </td>
                            <td className={cn(SECRET_KEY_TABLE_CELL_CLASS, 'text-muted')}>{key.roleName}</td>
                            <td className={cn(SECRET_KEY_TABLE_CELL_CLASS, 'font-mono text-foreground')}>{key.totalRequests.toLocaleString()}</td>
                            <td className={cn(SECRET_KEY_TABLE_CELL_CLASS, 'font-mono text-muted')}>{Math.round(key.avgResponseTime)} ms</td>
                            <td className={cn(SECRET_KEY_TABLE_CELL_CLASS, 'text-muted')}>
                                {key.lastRequestAt
                                    ? new Date(key.lastRequestAt).toLocaleDateString()
                                    : 'Never'}
                            </td>
                            <td className={SECRET_KEY_TABLE_CELL_CLASS}>
                                {/* Was an inline `--status-success` / `--status-error` style. */}
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
