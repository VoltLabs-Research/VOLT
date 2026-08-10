import usePluginResults from '../../hooks/use-plugin-results';

import PluginAtomsTable from '@/modules/plugin/components/listing/PluginAtomsTable';
import PluginExposureTable from '@/modules/plugin/components/listing/PluginExposureTable';
import ExposureChart from './ExposureChart';
import { usePluginListingQuery } from '@/modules/plugin/hooks/listing/queries';
import { Button, IconButton, Tooltip } from '@voltstack/bravais';

import './PluginResultsViewer.css';

interface PluginResultsViewerProps {
    pluginId: string;
    analysisId: string;
}

const ChartArtifactView = ({ artifact, pluginId, analysisId, trajectoryId }: {
    artifact: NonNullable<ReturnType<typeof usePluginResults>['activeChartArtifact']>;
    pluginId: string;
    analysisId: string;
    trajectoryId: string | undefined;
}) => {
    const exposureName = typeof artifact.metadata?.exposureName === 'string'
        ? artifact.metadata.exposureName
        : artifact.displayName;
    const listingQuery = usePluginListingQuery(
        {
            pluginId,
            analysisId,
            trajectoryId,
            exposureName
        },
        { enabled: Boolean(pluginId && analysisId && exposureName) }
    );
    const rows = listingQuery.data?.data ?? [];
    if (listingQuery.isLoading) {
        return <span className='text-xs text-muted' style={{ padding: '8px' }}>Loading chart data...</span>;
    }
    if (rows.length === 0) {
        return (
            <figure className="canvas-results-chart">
                <span className='text-xs text-muted' style={{ padding: '8px' }}>No row data available for chart.</span>
                <figcaption>{artifact.displayName}</figcaption>
            </figure>
        );
    }
    return <ExposureChart artifact={artifact} rows={rows} pluginId={pluginId} analysisId={analysisId} />;
};

const PluginResultsViewer = ({ pluginId, analysisId }: PluginResultsViewerProps) => {
    const {
        title, tabs, activeTab, setActiveTab,
        activeExposureName, activeExposureId, isAtomsTab, activeChartArtifact,
        trajectoryId, teamId,
        isDownloading, isEmpty, close, download
    } = usePluginResults({
        pluginId,
        analysisId
    });
    const resolvedTeamId = teamId ?? undefined;

    return (
        <div className='bg-surface border border-border flex flex-col absolute overflow-hidden w-full bottom-4 right-4 canvas-results-viewer'>
            <div className='flex flex-row items-center justify-between canvas-results-header panel-header-bordered'>
                <h3 className='text-xs font-medium text-foreground'>{title}</h3>
                <div className='flex flex-row items-center gap-2'>
                    {!isEmpty && (
                        <Tooltip content="Download as XLSX">
                            <Button
                                variant="ghost"
                                intent="canvas"
                                shape="rounded"
                                size="sm"
                                className="text-xs canvas-btn-compact"
                                onClick={download}
                                isLoading={isDownloading}
                            >
                                Download
                            </Button>
                        </Tooltip>
                    )}
                    <IconButton variant="ghost" size="sm" onClick={close} aria-label="Close results">
                        ×
                    </IconButton>
                </div>
            </div>

            {isEmpty ? (
                <div className='flex flex-row items-center justify-center p-2'>
                    <span className='text-xs text-muted'>No listings available for this analysis</span>
                </div>
            ) : (
                <>
                    <div className='flex flex-row items-center overflow-auto canvas-results-tabs' role="tablist">
                        {tabs.map((tab, index) => (
                            <Button
                                key={tab.key}
                                role="tab"
                                aria-selected={activeTab === index}
                                variant={activeTab === index ? 'solid' : 'ghost'}
                                intent="canvas"
                                shape="rounded"
                                size="sm"
                                className="text-xs canvas-btn-compact"
                                onClick={() => setActiveTab(index)}
                            >
                                {tab.label}
                            </Button>
                        ))}
                    </div>

                    <div className='overflow-auto canvas-results-content'>
                        {activeExposureName && (
                            <PluginExposureTable
                                key={`${activeExposureName}-${analysisId}`}
                                pluginId={pluginId}
                                exposureId={activeExposureId ?? undefined}
                                exposureName={activeExposureName}
                                trajectoryId={trajectoryId}
                                analysisId={analysisId}
                                teamId={resolvedTeamId}
                                compact={true}
                                inlineSubListings={true}
                            />
                        )}
                        {isAtomsTab && trajectoryId && (
                            <PluginAtomsTable
                                trajectoryId={trajectoryId}
                                analysisId={analysisId}
                            />
                        )}
                        {activeChartArtifact && (
                            <div className="canvas-results-charts">
                                <ChartArtifactView
                                    artifact={activeChartArtifact}
                                    pluginId={pluginId}
                                    analysisId={analysisId}
                                    trajectoryId={trajectoryId}
                                />
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default PluginResultsViewer;
