import { useMemo, useState } from 'react';
import { ListTree } from 'lucide-react';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import RightCollapsible, { PANEL_ICON_STYLE } from '../ObjectsPanel/RightCollapsible';
import PanelResultsTable from './PanelResultsTable';

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

/**
 * The analysis-results panel: the compact summary tables a plugin declares for the
 * right sidebar, in the spirit of OVITO's "Structure analysis results" /
 * "Dislocation analysis results" blocks sitting next to a modifier.
 *
 * Everything shown here is declared by the plugin (`exposure.panel`) and read from the
 * sub-listings it emitted. This component knows how to lay out a table and nothing
 * about what any row means, so a plugin can add a table or a category without a change
 * on this side.
 */
const AnalysisResultsSection = ({ analysisId, pluginId, currentTimestep }: AnalysisResultsSectionProps) => {
    const [expanded, setExpanded] = useState(true);
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

    // TEMPORARY diagnostic: remove once the gate is understood.
    console.warn('[panel-diag]', JSON.stringify({
        analysisId: analysisId ?? null,
        pluginId: pluginId ?? null,
        hasPlugin: Boolean(plugin),
        exposures: plugin?.exposures?.length ?? -1,
        withPanel: (plugin?.exposures ?? []).filter((e) => e.panel).map((e) => e.name),
        tables: tables.length,
        currentTimestep: currentTimestep ?? null
    }));

    // A plugin that declares nothing gets no section at all, rather than an empty one.
    if (!analysisId || tables.length === 0) {
        return null;
    }

    return (
        <RightCollapsible
            title='Analysis Results'
            icon={<ListTree style={PANEL_ICON_STYLE} />}
            expanded={expanded}
            onExpandedChange={setExpanded}
        >
            {currentTimestep === undefined ? (
                <span className='px-2 py-1 text-2xs text-muted'>Select a frame to see results.</span>
            ) : (
                <div className='flex flex-col gap-1'>
                    {tables.map(({ key, exposureId, table }) => (
                        <PanelResultsTable
                            key={key}
                            table={table}
                            analysisId={analysisId}
                            exposureId={exposureId}
                            timestep={currentTimestep}
                        />
                    ))}
                </div>
            )}
        </RightCollapsible>
    );
};

export default AnalysisResultsSection;
