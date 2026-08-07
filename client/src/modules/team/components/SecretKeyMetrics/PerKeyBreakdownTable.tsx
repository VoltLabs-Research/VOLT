import { Box, Heading, Stack, Surface, Text } from '@voltstack/bravais';
import type { SecretKeyPerKeyMetric } from '@volt/contracts/modules/team/domain';

interface PerKeyBreakdownTableProps {
    perKey: SecretKeyPerKeyMetric[];
}

const PerKeyBreakdownTable = ({ perKey }: PerKeyBreakdownTableProps) => (
    <Surface variant='glass' p='1-5' radius='lg'>
        <Heading level={3} size='lg' weight='bold' tone='primary' className='mb-6'>Per-Key Breakdown</Heading>
        <Box overflow='x-auto'>
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
                                <Stack>
                                    <Text weight='medium' tone='primary'>{key.name}</Text>
                                    <Text size='sm' tone='muted' className='font-mono'>{key.keyPrefix}...</Text>
                                </Stack>
                            </td>
                            <td className='text-secondary'>{key.roleName}</td>
                            <td className='font-mono text-primary'>{key.totalRequests.toLocaleString()}</td>
                            <td className='font-mono text-secondary'>{Math.round(key.avgResponseTime)} ms</td>
                            <td className='text-secondary'>
                                {key.lastRequestAt
                                    ? new Date(key.lastRequestAt).toLocaleDateString()
                                    : 'Never'}
                            </td>
                            <td>
                                <Text as='span' style={{ color: key.isActive ? 'var(--status-success)' : 'var(--status-error)' }}>
                                    {key.isActive ? 'Active' : 'Revoked'}
                                </Text>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Box>
    </Surface>
);

export default PerKeyBreakdownTable;
