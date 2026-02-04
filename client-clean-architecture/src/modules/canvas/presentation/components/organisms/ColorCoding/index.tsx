import { useState, useEffect } from 'react';
import usePropertySelector from '@/modules/trajectory/presentation/hooks/particle-filter/use-property-selector';
import EditorWidget from '@/modules/canvas/presentation/components/organisms/EditorWidget';
import Button from '@/shared/presentation/components/Button';
import FormField from '@/modules/canvas/presentation/components/atoms/FormField';
import Loader from '@/shared/presentation/components/Loader';
import useColorCodingUseCases from '@/modules/trajectory/presentation/hooks/color-coding/use-color-coding-use-cases';
import Title from '@/shared/presentation/components/Title';
import Container from '@/shared/presentation/components/Container';
import GradientPreview from '@/modules/canvas/presentation/components/atoms/GradientPreview';
import useToast from '@/shared/presentation/hooks/use-toast';
import useTrajectoryStore from '@/modules/trajectory/presentation/stores/use-trajectory-store';
import useAnalysisConfigStore from '@/modules/canvas/presentation/stores/use-analysis-config-store';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import '@/modules/canvas/presentation/components/organisms/ColorCoding/ColorCoding.css';

const COLOR_GRADIENTS = [
    'Viridis',
    'Plasma',
    'BlueRed',
    'GrayScale'
];

const ColorCoding = () => {
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);
    const currentTimestep = useEditorStore((state) => state.currentTimestep);
    const setActiveScene = useEditorStore((state) => state.setActiveScene);

    const {
        property,
        exposureId,
        propertyOptions,
        isLoading,
        handlePropertyChange
    } = usePropertySelector({
        trajectoryId: trajectory?._id,
        analysisId: analysisConfig?._id,
        timestep: currentTimestep
    });

    const { colorCodingRepository } = useColorCodingUseCases();
    const { showSuccess, showError } = useToast();

    const [startValue, setStartValue] = useState(0);
    const [endValue, setEndValue] = useState(0);
    const [gradient, setGradient] = useState('Viridis');
    const [automaticRange, setAutomaticRange] = useState(true);
    const [symmetricRange, setSymmetricRange] = useState(true);
    const [isFetchingStats, setIsFetchingStats] = useState(false);
    const [isApplying, setIsApplying] = useState(false);

    const applyColorCoding = async () => {
        if (!trajectory?._id || currentTimestep === undefined || !property) return;
        setIsApplying(true);
        try {
            await colorCodingRepository.apply({
                trajectoryId: trajectory._id,
                analysisId: analysisConfig?._id,
                timestep: currentTimestep,
                payload: {
                    property,
                    startValue,
                    endValue,
                    gradient,
                    exposureId: exposureId || undefined
                }
            });

            setActiveScene({
                analysisId: analysisConfig?._id,
                endValue: String(endValue),
                exposureId: exposureId || undefined,
                gradient,
                property,
                source: 'color-coding',
                startValue: String(startValue),
                sceneType: 'color-coding'
            } as any);

            showSuccess('Color coding applied successfully');
        } catch (error) {
            console.error(error);
            showError('Failed to apply color coding');
        } finally {
            setIsApplying(false);
        }
    };

    const fetchStats = async () => {
        if (!property || !trajectory?._id) return;

        const selectedOption = propertyOptions.find((opt) => opt.value === property);
        const type = selectedOption?.exposureId ? 'modifier' : 'base';

        if (type === 'modifier' && !analysisConfig?._id) return;

        setIsFetchingStats(true);
        try {
            const stats = await colorCodingRepository.getStats({
                trajectoryId: trajectory._id,
                analysisId: analysisConfig?._id,
                timestep: currentTimestep,
                property,
                type,
                exposureId: selectedOption?.exposureId || undefined
            });
            const { min, max } = stats;
            setStartValue(min);
            setEndValue(max);
        } catch (error) {
            console.error(error);
            showError('Failed to fetch property statistics');
        } finally {
            setIsFetchingStats(false);
        }
    };

    useEffect(() => {
        if (automaticRange) {
            fetchStats();
        }
    }, [automaticRange, currentTimestep, property, exposureId]);

    useEffect(() => {
        if (!symmetricRange) return;

        if (endValue === 0 && !automaticRange) {
            setAutomaticRange(true);
            return;
        }

        const limit = Math.max(Math.abs(startValue), Math.abs(endValue));
        setStartValue(-limit);
        setEndValue(limit);
    }, [symmetricRange, endValue]);

    return (
        <EditorWidget className='color-coding-container p-1 overflow-hidden d-flex column gap-1' draggable={false}>
            <Container className='d-flex content-between items-center'>
                <Title className='font-weight-5-5'>Color Coding</Title>
                {isFetchingStats && <Loader scale={0.5} isFixed={false} />}
            </Container>

            <Container className='d-flex column gap-1'>
                <FormField
                    fieldKey='property'
                    fieldType='select'
                    label='Property'
                    fieldValue={property}
                    onFieldChange={(_, value) => handlePropertyChange(String(value))}
                    options={propertyOptions}
                />

                <FormField
                    fieldKey='gradient'
                    fieldType='select'
                    label='Color Gradient'
                    fieldValue={gradient}
                    onFieldChange={(_, value) => setGradient(String(value))}
                    options={COLOR_GRADIENTS.map((color) => ({ value: color, title: color }))}
                />

                <GradientPreview
                    gradient={gradient}
                    startValue={startValue}
                    endValue={endValue}
                />

                <FormField
                    fieldKey='startValue'
                    fieldType='input'
                    onFieldChange={(_, value) => setStartValue(Number(value))}
                    fieldValue={startValue}
                    label='Start value'
                />

                <FormField
                    fieldKey='endValue'
                    onFieldChange={(_, value) => setEndValue(Number(value))}
                    fieldValue={endValue}
                    fieldType='input'
                    label='End value'
                />

                <FormField
                    fieldKey='automaticRange'
                    fieldType='checkbox'
                    label='Automatic Range'
                    fieldValue={automaticRange}
                    onFieldChange={(_, value) => setAutomaticRange(Boolean(value))}
                />
                <FormField
                    fieldKey='symmetricRange'
                    fieldType='checkbox'
                    label='Symmetric Range'
                    fieldValue={symmetricRange}
                    onFieldChange={(_, value) => setSymmetricRange(Boolean(value))}
                />
            </Container>

            <Container className='color-coding-footer-container'>
                <Button
                    isLoading={isApplying}
                    variant='solid'
                    intent='brand'
                    block
                    onClick={applyColorCoding}
                    disabled={isLoading || isFetchingStats || isApplying}
                >
                    Apply
                </Button>
            </Container>
        </EditorWidget>
    );
};

export default ColorCoding;
