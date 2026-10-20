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
            <div className='p-4'>
                <span className='text-xs text-muted'>No parameters configured.</span>
            </div>
        );
    }

    return (
        <div className='p-4'>
            <div className='flex flex-row items-start flex-wrap gap-6'>
                {columns.map((column) => (
                    <div className='flex flex-col gap-2' key={column.key} style={{ minWidth: 140 }}>
                        <span className='text-xs text-muted'>{column.title}</span>
                        {column.rows.map((row, rowIndex) => (
                            <div className='flex flex-row items-center justify-between gap-4 text-xs text-muted' key={`${row.label}:${rowIndex}`}>
                                <span className='text-muted'>{row.label}</span>
                                {row.value}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ExecutionConfigSummary;
