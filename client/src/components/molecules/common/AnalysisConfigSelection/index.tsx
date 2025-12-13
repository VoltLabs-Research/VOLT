import EditorWidget from '@/components/organisms/scene/EditorWidget';
import useTrajectoryStore from '@/stores/trajectories';
import useAnalysisConfigStore from '@/stores/analysis-config';
import usePluginStore from '@/stores/plugins/plugin';
import Select from '@/components/atoms/form/Select';
import './AnalysisConfigSelection.css';
import { useCallback, useEffect, useMemo } from 'react';

const AnalysisConfigSelection = () => {
    const trajectory = useTrajectoryStore((s) => s.trajectory);
    const isLoading = useTrajectoryStore((s) => s.isLoading);
    const analysisConfig = useAnalysisConfigStore((s) => s.analysisConfig);
    const updateAnalysisConfig = useAnalysisConfigStore((s) => s.updateAnalysisConfig);
    const plugins = usePluginStore((s) => s.plugins);
    const fetchPlugins = usePluginStore((s) => s.fetchPlugins);
    const getModifiers = usePluginStore((s) => s.getModifiers);

    const analysisList = trajectory?.analysis ?? [];
    const selectedId = analysisConfig?._id ?? '';

    useEffect(() => {
        if (plugins.length === 0) {
            fetchPlugins();
        }
    }, [plugins, fetchPlugins]);

    const handleChange = useCallback((configId: string) => {
        if (!analysisList.length) return;
        const config = analysisList.find(({ _id }) => _id === configId);
        if (config) updateAnalysisConfig(config);
    }, [analysisList, updateAnalysisConfig]);

    // Build options from analysis list using modifiers from plugins
    const options = useMemo(() => {
        const modifiers = getModifiers();

        return analysisList.map((analysis: any) => {
            const modifier = modifiers.find(m => m.pluginSlug === analysis.plugin);
            const name = modifier?.name || analysis.plugin || 'Unknown';

            return {
                value: analysis._id,
                label: name,
                title: name
            };
        });
    }, [analysisList, getModifiers]);

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
