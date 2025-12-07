import useAnalysisConfigStore from '@/stores/analysis-config';
import usePlaybackStore from '@/stores/editor/playback';
import useTrajectoryStore from '@/stores/trajectories';
import useFrameProperties from '@/hooks/trajectory/use-frame-properties';
import EditorWidget from '@/components/organisms/scene/EditorWidget';
import Button from '@/components/atoms/common/Button';
import FormField from '@/components/molecules/form/FormField';
import './ColorCoding.css';

const COLOR_GRADIENTS = [
    'Viridis',
    'Blue-White-Red',
    'Cyclic-Rainbow',
    'Grayscale'
];

const ColorCoding = () => {
    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);
    const currentTimestep = usePlaybackStore((state) => state.currentTimestep);
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const { properties, isLoading } = useFrameProperties({
        analysisId: analysisConfig?._id,
        trajectoryId: trajectory?._id,
        frame: currentTimestep
    });

    const applyColorCoding = async () => {

    };

    return (
        <EditorWidget className='color-coding-container' draggable={false}>
            <div className='editor-floating-header-container'>
                <h3 className='editor-floating-header-title'>Color Coding</h3>
            </div>

            <div className='color-coding-body-container'>
                <FormField
                    fieldType='select'
                    label='Property'
                    options={properties.map((prop) => ({ value: prop, title: prop }))}
                />

                <FormField
                    fieldType='select'
                    label='Color Gradient'
                    options={COLOR_GRADIENTS.map((color) => ({ value: color, title: color }))}
                />

                <FormField
                    fieldType='input'
                    label='Start value'
                />

                <FormField
                    fieldType='input'
                    label='End value'
                />
            </div>

            <div className='color-coding-footer-container'>
                <Button
                    isLoading={isLoading}
                    className='smooth click-scale start-analysis-btn'
                    title='Apply'
                    onClick={applyColorCoding}
                    disabled={isLoading}
                />
            </div>
        </EditorWidget>
    );
};

export default ColorCoding;