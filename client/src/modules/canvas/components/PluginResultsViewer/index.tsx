import usePluginResults from '../../hooks/use-plugin-results';

import PluginAtomsTable from '@/modules/plugin/components/listing/PluginAtomsTable';
import PluginExposureTable from '@/modules/plugin/components/listing/PluginExposureTable';
import ExposureChart from './ExposureChart';
import { usePluginListingQuery } from '@/modules/plugin/hooks/listing/queries';
import { Button, CloseButton, Tooltip, cn } from '@heroui/react';

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
            <figure className='m-0 grid gap-1'>
                <span className='text-xs text-muted' style={{ padding: '8px' }}>No row data available for chart.</span>
                <figcaption className='truncate text-[0.6875rem] text-muted'>{artifact.displayName}</figcaption>
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
        <div className='absolute bottom-4 right-4 z-[200] flex max-h-[280px] w-full flex-col overflow-hidden rounded-xl border border-border bg-surface'>
            <div className='flex flex-row items-center justify-between border-b border-border px-2.5 py-1.5'>
                <h3 className='text-xs font-medium text-foreground'>{title}</h3>
                <div className='flex flex-row items-center gap-2'>
                    {!isEmpty && (
                        <Tooltip>
                            <Button
                                variant='ghost'
                                size='sm'
                                className='text-xs'
                                onPress={download}
                                isPending={isDownloading}
                            >
                                Download
                            </Button>
                            <Tooltip.Content placement='bottom'>Download as XLSX</Tooltip.Content>
                        </Tooltip>
                    )}
                    <CloseButton onPress={close} aria-label='Close results' />
                </div>
            </div>

            {isEmpty ? (
                <div className='flex flex-row items-center justify-center p-2'>
                    <span className='text-xs text-muted'>No listings available for this analysis</span>
                </div>
            ) : (
                <>
                    <div className='flex flex-row items-center overflow-auto border-b border-border px-1.5 py-1' role='tablist'>
                        {tabs.map((tab, index) => (
                            <button
                                key={tab.key}
                                type='button'
                                role='tab'
                                aria-selected={activeTab === index}
                                className={cn(
                                    'inline-flex h-[1.875rem] min-h-[2.1rem] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-3.5 text-[0.8125rem] font-medium leading-none select-none transition-colors duration-150 ease-out',
                                    activeTab === index ? 'bg-default text-foreground hover:bg-surface-hover' : 'bg-transparent text-muted hover:bg-surface-hover hover:text-foreground'
                                )}
                                onClick={() => setActiveTab(index)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className='max-h-[180px] overflow-auto p-1.5'>
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
                            <div className='grid min-w-[320px] grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2'>
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
