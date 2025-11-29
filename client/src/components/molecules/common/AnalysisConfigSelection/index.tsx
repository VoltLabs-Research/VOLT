import EditorWidget from '@/components/organisms/scene/EditorWidget';
import useTrajectoryStore from '@/stores/trajectories';
import useAnalysisConfigStore from '@/stores/analysis-config';
import usePluginStore from '@/stores/plugins';
import Select from '@/components/atoms/form/Select';
import { useAnalysisFormatting } from '@/hooks/useAnalysisFormatting';
import './AnalysisConfigSelection.css';
import { useCallback, useEffect, useMemo } from 'react';

const AnalysisConfigSelection = () => {
    const trajectory = useTrajectoryStore((s) => s.trajectory);
    const isLoading = useTrajectoryStore((s) => s.isLoading);
    const analysisConfig = useAnalysisConfigStore((s) => s.analysisConfig);
    const updateAnalysisConfig = useAnalysisConfigStore((s) => s.updateAnalysisConfig);
    const manifests = usePluginStore((s) => s.manifests);
    const fetchManifests = usePluginStore((s) => s.fetchManifests);

    const analysisList = trajectory?.analysis ?? [];
    const selectedId = analysisConfig?._id ?? '';

    useEffect(() => {
        if (Object.keys(manifests || {}).length === 0) {
            fetchManifests();
        }
    }, [manifests, fetchManifests]);

    const handleChange = useCallback((configId: string) => {
        if (!analysisList.length) return;
        const config = analysisList.find(({ _id }) => _id === configId);
        if (config) updateAnalysisConfig(config);
    }, [analysisList, updateAnalysisConfig]);

    // Use the shared hook with diff detection enabled
    const options = useAnalysisFormatting(analysisList, manifests, {
        showDiffWhenMultiple: true
    });

    if (isLoading) return null;

    return (
        <EditorWidget className="analysis-config-selection-container">
            <Select
                onDark={true}
                value={selectedId}
                className="analysis-config-select-container"
                onChange={handleChange}
                options={options}
                showSelectionIcon={false}
                disabled={!analysisList.length}
            />
        </EditorWidget>
    );
};

export default AnalysisConfigSelection;
