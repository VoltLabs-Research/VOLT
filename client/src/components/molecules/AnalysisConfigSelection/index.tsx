import EditorWidget from '@/components/organisms/EditorWidget';
import useTrajectoryStore from '@/stores/trajectories';
import useAnalysisConfigStore from '@/stores/analysis-config';
import Select from '@/components/atoms/form/Select';
import formatTimeAgo from '@/utilities/formatTimeAgo';
import './AnalysisConfigSelection.css';
import { useCallback, useMemo } from 'react';

const AnalysisConfigSelection = () => {
    const trajectory = useTrajectoryStore((s) => s.trajectory);
    const isLoading = useTrajectoryStore((s) => s.isLoading);
    const analysisConfig = useAnalysisConfigStore((s) => s.analysisConfig);
    const updateAnalysisConfig = useAnalysisConfigStore((s) => s.updateAnalysisConfig);

    const analysisList = trajectory?.analysis ?? [];
    const selectedId = analysisConfig?._id ?? '';

    const handleChange = useCallback((configId: string) => {
        if(!analysisList.length) return;
        const config = analysisList.find(({ _id }) => _id === configId);
        if(config) updateAnalysisConfig(config);
    }, [analysisList, updateAnalysisConfig]);

    const options = useMemo(() => {
        return (analysisList || []).map((config: any) => {
            const title = `${config.identificationMode} · ${formatTimeAgo(config.createdAt)}${
                config.identificationMode === 'PTM' && config.RMSD != null ? ` (RMSD ${config.RMSD})` : ''
            }`;
            const descParts: string[] = [];
            if(typeof config.maxTrialCircuitSize === 'number') descParts.push(`Max Trial Circuit Size: ${config.maxTrialCircuitSize}`);
            if(typeof config.circuitStretchability === 'number') descParts.push(`Circuit Stretchability: ${config.circuitStretchability}`);
            const description = descParts.join(' · ');
            return {
                value: config._id,
                title,
                description
            };
        });
    }, [analysisList]);

    if(isLoading) return null;

    return (
        <EditorWidget className="analysis-config-selection-container">
            <Select
                onDark={true}
                value={selectedId}
                className="analysis-config-select-container"
                onChange={handleChange}
                options={options}
                disabled={!analysisList.length}
            />
        </EditorWidget>
    );
};

export default AnalysisConfigSelection;
