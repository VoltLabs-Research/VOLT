import { useCallback, useEffect, useMemo, useState } from 'react';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import RightCollapsible from '../ObjectsPanel/RightCollapsible';
import PanelResultsTable from './PanelResultsTable';

import type { PanelResultsStatus } from './PanelResultsTable';
import type { IPanelTable } from '@volt/contracts/modules/plugin/exposure';

interface AnalysisResultsSectionProps {
    analysisId?: string;
    pluginId?: string;
    currentTimestep?: number;
}

interface ResolvedPanelTable {
    key: string;
    exposureId: string;
    table: IPanelTable;
}

const AnalysisResultsSection = ({ analysisId, pluginId, currentTimestep }: AnalysisResultsSectionProps) => {
    const [expanded, setExpanded] = useState(true);
    const [statusByKey, setStatusByKey] = useState<Record<string, PanelResultsStatus>>({});
    const { pluginsById } = usePluginSelectors();
    const plugin = pluginId ? pluginsById[pluginId] : undefined;

    const tables = useMemo<ResolvedPanelTable[]>(() => {
        const exposures = plugin?.exposures ?? [];
        return exposures.flatMap((exposure) => {
            const declared = exposure.panel?.tables ?? [];
            return declared.map((table) => ({
                key: `${exposure._id}:${table.source}`,
                exposureId: exposure._id,
                table
            }));
        });
    }, [plugin]);

    const handleStatusChange = useCallback((key: string, status: PanelResultsStatus) => {
        setStatusByKey((current) => {
            if (current[key] === status) {
                return current;
            }

            return {
                ...current,
                [key]: status
            };
        });
    }, []);

    useEffect(() => {
        setStatusByKey({});
    }, [analysisId, currentTimestep]);

    const hasResults = tables.some((entry) => statusByKey[entry.key] === 'ready');

    if (!analysisId || tables.length === 0 || currentTimestep === undefined) {
        return null;
    }

    const tablesNode = (
        <div className='flex flex-col gap-1'>
            {tables.map(({ key, exposureId, table }) => (
                <PanelResultsTable
                    key={key}
                    table={table}
                    analysisId={analysisId}
                    exposureId={exposureId}
                    timestep={currentTimestep}
                    onStatusChange={(status) => handleStatusChange(key, status)}
                />
            ))}
        </div>
    );

    if (!hasResults) {
        return <div className='hidden'>{tablesNode}</div>;
    }

    return (
        <RightCollapsible
            title='Analysis Results'
            expanded={expanded}
            onExpandedChange={setExpanded}
        >
            {tablesNode}
        </RightCollapsible>
    );
};

export default AnalysisResultsSection;
