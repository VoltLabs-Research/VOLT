import EditorWidget from '@/components/organisms/EditorWidget';
import useTrajectoryStore from '@/stores/trajectories';
import useAnalysisConfigStore from '@/stores/analysis-config';
import Select from '@/components/atoms/form/Select';
import formatTimeAgo from '@/utilities/formatTimeAgo';
import './AnalysisConfigSelection.css';

// TODO: ugly component
const AnalysisConfigSelection = () => {
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const isLoading = useTrajectoryStore((state) => state.isLoading);
    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);
    const updateAnalysisConfig = useAnalysisConfigStore((state) => state.updateAnalysisConfig);

    const handleChange = (configId: string) => {
        if(trajectory && !trajectory.analysis.length) return;
        
        const config = trajectory?.analysis.find(({ _id }) => _id === configId);
        updateAnalysisConfig(config);
    };

    return (!isLoading) && (
        <EditorWidget className='analysis-config-selection-container'>
            <Select
                value={analysisConfig._id}
                className='analysis-config-select-container'
                onChange={handleChange}
                options={(trajectory.analysis ?? []).map((config) => ({
                    value: config._id,
                    title: `${config.identificationMode} - ${formatTimeAgo(config.createdAt)} ${config.identificationMode === 'PTM' ? '(RMSD' + config.RMSD + ')' : ''}`
                }))} />
        </EditorWidget>
    );
};

export default AnalysisConfigSelection;