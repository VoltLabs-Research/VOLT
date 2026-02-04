import { useState, useMemo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { RiCloseLine, RiDownloadLine } from 'react-icons/ri';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import { usePluginStore } from '@/modules/plugin';
import useTrajectoryStore from '@/modules/trajectory/presentation/stores/use-trajectory-store';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import Loader from '@/shared/presentation/components/Loader';
import useToast from '@/shared/presentation/hooks/use-toast';
import usePluginUseCases from '@/modules/plugin/presentation/hooks/use-plugin-use-cases';
import PluginExposureTable from '@/modules/plugin/presentation/components/organisms/PluginExposureTable';
import PluginAtomsTable from '@/modules/plugin/presentation/components/organisms/PluginAtomsTable';
import '@/modules/canvas/presentation/components/organisms/PluginResultsViewer/PluginResultsViewer.css';

interface PluginResultsViewerProps {
    pluginSlug: string;
    analysisId: string;
}

const PluginResultsViewer = ({
    pluginSlug,
    analysisId
}: PluginResultsViewerProps) => {
    const { removeParam } = useSearchParamsState();
    const closeResults = () => {
        removeParam('results', { replace: true });
    };
    const plugin = usePluginStore((state) => state.pluginsBySlug[pluginSlug]);
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const team = useTeamStore(useShallow((state) => state.selectedTeam));
    const { pluginRepository } = usePluginUseCases();

    const [isDownloading, setIsDownloading] = useState(false);
    const { showSuccess } = useToast();

    const [activeTab, setActiveTab] = useState(0);

    const exposures = plugin?.exposures ?? [];

    const listingExposures = useMemo(() => {
        return exposures.filter((exp) => Boolean(exp.name));
    }, [exposures]);

    const perAtomProperties = useMemo(() => {
        const properties = new Set<string>();
        exposures.forEach((exp) => {
            if (exp.perAtomProperties) {
                exp.perAtomProperties.forEach((p) => properties.add(p));
            }
        });
        return Array.from(properties);
    }, [exposures]);

    const hasAtomsTab = perAtomProperties.length > 0;
    const atomsTabIndex = listingExposures.length;

    const activeExposure = activeTab < listingExposures.length ? listingExposures[activeTab] : null;
    const isAtomsTabActive = hasAtomsTab && activeTab === atomsTabIndex;

    const atomExposureId = useMemo(() => {
        if (!exposures.length) return undefined;

        const atomExposure = exposures.find((e) =>
            e.perAtomProperties && e.perAtomProperties.length > 0
        );
        return atomExposure?._id || exposures[0]?._id;
    }, [exposures]);

    const handleDownload = useCallback(async () => {
        try {
            setIsDownloading(true);
            const blob = await pluginRepository.exportAnalysisResults(pluginSlug, analysisId);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${pluginSlug}_analysis_${analysisId}.zip`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            showSuccess('Analysis results downloaded successfully');
        } catch (error) {
            console.error('Failed to download results:', error);
        } finally {
            setIsDownloading(false);
        }
    }, [pluginSlug, analysisId, showSuccess, pluginRepository]);

    if (listingExposures.length === 0 && !hasAtomsTab) {
        return (
            <Container className='plugin-results-viewer-container d-flex column p-absolute h-max overflow-hidden'>
                <Container className='plugin-results-header d-flex items-center content-between p-1'>
                    <Title className='font-size-3 font-weight-5'>{plugin?.modifier?.name || plugin?.slug || pluginSlug}</Title>
                    <i className='plugin-results-close cursor-pointer' onClick={closeResults}>
                        <RiCloseLine size={20} />
                    </i>
                </Container>
                <Container className='plugin-results-empty d-flex items-center content-center flex-1 p-1 text-center font-size-1 color-muted'>
                    <span className='color-muted font-size-2'>No listings available for this analysis</span>
                </Container>
            </Container>
        );
    }

    return (
        <Container className='plugin-results-viewer-container d-flex column p-absolute h-max overflow-hidden'>
            <Container className='plugin-results-header d-flex items-center content-between p-1'>
                <Title className='font-size-3 font-weight-5'>{plugin?.modifier?.name || plugin?.slug || pluginSlug}</Title>
                <Container className='d-flex items-center gap-05'>
                    <i
                        className='plugin-results-download cursor-pointer'
                        onClick={handleDownload}
                        title='Download as XLSX'
                    >
                        {isDownloading ? <Loader scale={0.4} /> : <RiDownloadLine size={18} />}
                    </i>
                    <i className='plugin-results-close cursor-pointer' onClick={closeResults}>
                        <RiCloseLine size={20} />
                    </i>
                </Container>
            </Container>

            <Container className='plugin-results-tabs-container d-flex gap-05 px-1 w-max'>
                {listingExposures.map((exposure, index) => (
                    <button
                        key={`${exposure.exposureId}-${index}`}
                        className={`plugin-results-tab ${activeTab === index ? 'active' : ''} font-size-1 font-weight-4 cursor-pointer`}
                        onClick={() => setActiveTab(index)}
                    >
                        <span className='plugin-results-tab-name overflow-hidden'>{exposure.name}</span>
                    </button>
                ))}
                {hasAtomsTab && (
                    <button
                        className={`plugin-results-tab ${isAtomsTabActive ? 'active' : ''} font-size-1 font-weight-4 cursor-pointer`}
                        onClick={() => setActiveTab(atomsTabIndex)}
                    >
                        <span className='plugin-results-tab-name overflow-hidden'>Atoms</span>
                    </button>
                )}
            </Container>

            <Container className='plugin-results-content flex-1 y-auto'>
                {activeExposure && (
                    <PluginExposureTable
                        key={`${activeExposure._id}-${analysisId}`}
                        pluginSlug={pluginSlug}
                        listingSlug={activeExposure.name}
                        trajectoryId={trajectory?._id}
                        analysisId={analysisId}
                        teamId={team?._id}
                        compact
                    />
                )}
                {isAtomsTabActive && atomExposureId && trajectory && (
                    <PluginAtomsTable
                        trajectoryId={trajectory._id}
                        analysisId={analysisId}
                        exposureId={atomExposureId}
                    />
                )}
            </Container>
        </Container>
    );
};

export default PluginResultsViewer;
