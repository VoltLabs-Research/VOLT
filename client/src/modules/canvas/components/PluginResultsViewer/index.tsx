import usePluginResults from '../../hooks/use-plugin-results';

import PluginAtomsTable from '@/modules/plugin/components/listing/PluginAtomsTable';
import PluginExposureTable from '@/modules/plugin/components/listing/PluginExposureTable';
import Box from '@/shared/presentation/primitives/Box';
import Button from '@/shared/presentation/primitives/Button';
import Heading from '@/shared/presentation/primitives/Heading';
import IconButton from '@/shared/presentation/primitives/IconButton';
import Row from '@/shared/presentation/primitives/Row';
import Surface from '@/shared/presentation/primitives/Surface';
import Text from '@/shared/presentation/primitives/Text';
import Tooltip from '@/shared/presentation/primitives/Tooltip';

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
        <Surface variant='glass' display='flex' direction='column' position='absolute' right='1' bottom='1' width='max' overflow='hidden' className="canvas-results-viewer">
            <Row justify='between' className="canvas-results-header panel-header-bordered">
                <Heading level={3} size='sm'>{title}</Heading>
                <Row gap='05'>
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
                </Row>
            </Row>

            {isEmpty ? (
                <Row justify='center' p='05'>
                    <Text size='sm' tone='muted'>No listings available for this analysis</Text>
                </Row>
            ) : (
                <>
                    <Row overflow='auto' className="canvas-results-tabs" role="tablist">
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
                    </Row>

                    <Box overflow='auto' className="canvas-results-content">
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
                    </Box>
                </>
            )}
        </Surface>
    );
};

export default PluginResultsViewer;
