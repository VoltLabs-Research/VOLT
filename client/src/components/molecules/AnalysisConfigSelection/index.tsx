import EditorWidget from '@/components/organisms/EditorWidget';
import useTrajectoryStore from '@/stores/trajectories';
import useAnalysisConfigStore from '@/stores/analysis-config';
import Select from '@/components/atoms/form/Select';
import formatTimeAgo from '@/utilities/formatTimeAgo';
import './AnalysisConfigSelection.css';

const AnalysisConfigSelection = () => {
    const trajectory = useTrajectoryStore((s) => s.trajectory);
    const isLoading = useTrajectoryStore((s) => s.isLoading);
    const analysisConfig = useAnalysisConfigStore((s) => s.analysisConfig);
    const updateAnalysisConfig = useAnalysisConfigStore((s) => s.updateAnalysisConfig);

    const analysisList = trajectory?.analysis ?? [];
    const selectedId = analysisConfig?._id ?? '';

    const handleChange = (configId: string) => {
        if(!analysisList.length) return;
        const config = analysisList.find(({ _id }) => _id === configId);
        if(config) updateAnalysisConfig(config);
    };

    if(isLoading) return null;

    return (
        <EditorWidget className="analysis-config-selection-container">
        <Select
            value={selectedId}
            className="analysis-config-select-container"
            onChange={handleChange}
            options={analysisList.map((config) => ({
            value: config._id,
            title: `${config.identificationMode} - ${formatTimeAgo(config.createdAt)}${
                config.identificationMode === 'PTM' && config.RMSD != null ? ` (RMSD ${config.RMSD})` : ''
            }`,
            }))}
            disabled={!analysisList.length}
        />
        </EditorWidget>
    );
};

export default AnalysisConfigSelection;
