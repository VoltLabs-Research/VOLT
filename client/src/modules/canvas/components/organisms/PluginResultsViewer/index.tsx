import usePluginResults from '../../../hooks/use-plugin-results';

import PluginAtomsTable from '@/modules/plugin/components/listing/organisms/PluginAtomsTable';
import PluginExposureTable from '@/modules/plugin/components/listing/organisms/PluginExposureTable';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import Title from '@/shared/presentation/components/Title';
import Tooltip from '@/shared/presentation/components/Tooltip';

import './PluginResultsViewer.css';

interface PluginResultsViewerProps {
    pluginId: string;
    analysisId: string;
};

const PluginResultsViewer = ({ pluginId, analysisId }: PluginResultsViewerProps) => {
    const {
        title, tabs, activeTab, setActiveTab,
        activeExposureName, activeExposureId, isAtomsTab,
        trajectoryId, teamId,
        isDownloading, isEmpty, close, download
    } = usePluginResults({ pluginId, analysisId });
    const resolvedTeamId = teamId ?? undefined;

    return (
        <Container className="canvas-results-viewer glass-bg d-flex column p-absolute right-1 bottom-1 w-max overflow-hidden">
            <Container className="canvas-results-header d-flex items-center content-between panel-header-bordered">
                <Title className="font-size-1">{title}</Title>
                <Container className="d-flex items-center gap-05">
                    {!isEmpty && (
                        <Tooltip content="Download as XLSX">
                            <Button
                                variant="ghost"
                                intent="canvas"
                                shape="rounded"
                                size="sm"
                                className="font-size-05 canvas-btn-compact"
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
                </Container>
            </Container>

            {isEmpty ? (
                <Container className="d-flex items-center content-center p-05">
                    <span className="color-muted font-size-1">No listings available for this analysis</span>
                </Container>
            ) : (
                <>
                    <Container className="canvas-results-tabs d-flex items-center overflow-auto" role="tablist">
                        {tabs.map((label, index) => (
                            <Button
                                key={label}
                                role="tab"
                                aria-selected={activeTab === index}
                                variant={activeTab === index ? 'solid' : 'ghost'}
                                intent="canvas"
                                shape="rounded"
                                size="sm"
                                className="font-size-05 canvas-btn-compact"
                                onClick={() => setActiveTab(index)}
                            >
                                {label}
                            </Button>
                        ))}
                    </Container>

                    <Container className="canvas-results-content overflow-auto">
                        {activeExposureName && (
                            <PluginExposureTable
                                key={`${activeExposureName}-${analysisId}`}
                                pluginId={pluginId}
                                exposureId={activeExposureId ?? undefined}
                                exposureName={activeExposureName}
                                trajectoryId={trajectoryId}
                                analysisId={analysisId}
                                teamId={resolvedTeamId}
                                compact
                            />
                        )}
                        {isAtomsTab && trajectoryId && (
                            <PluginAtomsTable
                                trajectoryId={trajectoryId}
                                analysisId={analysisId}
                            />
                        )}
                    </Container>
                </>
            )}
        </Container>
    );
};

export default PluginResultsViewer;
