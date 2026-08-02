import { Box, Row, Stack, Text } from '@voltstack/bravais';
import { buildConfigColumns } from './config-columns';
import { useMemo } from 'react';

import type { Plugin } from '@volt/contracts/modules/plugin/plugin';

interface ExecutionConfigSummaryProps {
    config: Record<string, unknown>;
    plugin?: Plugin;
    pluginsById?: Record<string, Plugin>;
}

const ExecutionConfigSummary = ({ config, plugin, pluginsById }: ExecutionConfigSummaryProps) => {
    const columns = useMemo(() => {
        return buildConfigColumns(config, plugin, pluginsById);
    }, [config, plugin, pluginsById]);

    if (columns.length === 0) {
        return (
            <Box p='1'>
                <Text size='sm' tone='muted'>No parameters configured.</Text>
            </Box>
        );
    }

    return (
        <Box p='1'>
            <Row align='start' gap='1-5' wrap>
                {columns.map((column) => (
                    <Stack key={column.key} gap='05' style={{ minWidth: 140 }}>
                        <Text size='xs' tone='muted'>{column.title}</Text>
                        {column.rows.map((row, rowIndex) => (
                            <Row key={`${row.label}:${rowIndex}`} justify='between' gap='1' className='font-size-1 color-secondary'>
                                <Text tone='muted'>{row.label}</Text>
                                {row.value}
                            </Row>
                        ))}
                    </Stack>
                ))}
            </Row>
        </Box>
    );
};

export default ExecutionConfigSummary;
