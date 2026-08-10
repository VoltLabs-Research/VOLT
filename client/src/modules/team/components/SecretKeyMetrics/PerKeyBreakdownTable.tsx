import type { SecretKeyPerKeyMetric } from '@volt/contracts/modules/team/domain';

interface PerKeyBreakdownTableProps {
    perKey: SecretKeyPerKeyMetric[];
}

const PerKeyBreakdownTable = ({ perKey }: PerKeyBreakdownTableProps) => (
    <div className='bg-surface border border-border p-6 rounded-2xl'>
        <h3 className='text-base font-semibold text-foreground mb-6'>Per-Key Breakdown</h3>
        <div className='overflow-x-auto'>
            <table className='secret-key-page-table'>
                <thead>
                    <tr>
                        <th>Key</th>
                        <th>Role</th>
                        <th>Requests</th>
                        <th>Avg Response</th>
                        <th>Last Used</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {perKey.map((key) => (
                        <tr key={key.secretKeyId}>
                            <td>
                                <div className='flex flex-col'>
                                    <span className='font-medium text-foreground'>{key.name}</span>
                                    <span className='text-xs text-muted font-mono'>{key.keyPrefix}...</span>
                                </div>
                            </td>
                            <td className='text-muted'>{key.roleName}</td>
                            <td className='font-mono text-foreground'>{key.totalRequests.toLocaleString()}</td>
                            <td className='font-mono text-muted'>{Math.round(key.avgResponseTime)} ms</td>
                            <td className='text-muted'>
                                {key.lastRequestAt
                                    ? new Date(key.lastRequestAt).toLocaleDateString()
                                    : 'Never'}
                            </td>
                            <td>
                                <span style={{ color: key.isActive ? 'var(--status-success)' : 'var(--status-error)' }}>
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
