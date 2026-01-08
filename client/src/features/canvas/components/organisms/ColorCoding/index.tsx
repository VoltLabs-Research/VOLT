import usePropertySelector from '@/features/trajectory/hooks/use-property-selector';
import EditorWidget from '@/features/canvas/components/organisms/EditorWidget';
import Button from '@/components/primitives/Button';
import FormField from '@/components/molecules/form/FormField';
import rasterApi from '@/features/raster/api/raster';
import { useState, useEffect } from 'react';
import Title from '@/components/primitives/Title';
import Container from '@/components/primitives/Container';
import { useUIStore } from '@/stores/slices/ui';
import '@/features/canvas/components/organisms/ColorCoding/ColorCoding.css';

const COLOR_GRADIENTS = [
    'Viridis',
    'Blue-White-Red',
    'Cyclic-Rainbow',
    'Grayscale'
];

const ColorCoding = () => {
    const {
        property,
        exposureId,
        propertyOptions,
        isLoading,
        handlePropertyChange,
        trajectory,
        analysisConfig,
        currentTimestep,
        setActiveScene
    } = usePropertySelector();

    const [startValue, setStartValue] = useState(0);
    const [endValue, setEndValue] = useState(0);
    const [gradient, setGradient] = useState('Viridis');
    const [automaticRange, setAutomaticRange] = useState(false);
    const [symmetricRange, setSymmetricRange] = useState(false);

    const [isStatsLoading, setIsStatsLoading] = useState(false);
    const addToast = useUIStore((state) => state.addToast);

    const applyColorCoding = async () => {
        try {
            await rasterApi.colorCoding.apply(trajectory!._id, analysisConfig?._id, currentTimestep!, {
                property, startValue, endValue, gradient, exposureId: exposureId || undefined
            });
            setActiveScene({
                analysisId: analysisConfig?._id,
                endValue,
                exposureId: exposureId || undefined,
                gradient,
                property,
                source: 'color-coding',
                startValue
            } as any);
            addToast('Color coding applied successfully', 'success');
        } catch (error) {
            console.error(error);
            addToast('Failed to apply color coding', 'error');
        }
    };

    const fetchStats = async () => {
        if (!property || !trajectory?._id) return;

        const selectedOption = propertyOptions.find(opt => opt.value === property);
        const type = selectedOption?.exposureId ? 'modifier' : 'base';

        // For modifier type, we need analysisId
        if (type === 'modifier' && !analysisConfig?._id) return;

        setIsStatsLoading(true);
        try {
            const stats = await rasterApi.colorCoding.getStats(trajectory._id, analysisConfig?._id, {
                timestep: currentTimestep,
                property,
                type,
                exposureId: selectedOption?.exposureId || undefined
            });
            const { min, max } = stats;

            if (symmetricRange) {
                const limit = Math.max(Math.abs(min), Math.abs(max));
                setStartValue(-limit);
                setEndValue(limit);
            } else {
                setStartValue(min);
                setEndValue(max);
            }
        } catch (e) {
            console.error(e);
            addToast('Failed to fetch property statistics', 'error');
        } finally {
            setIsStatsLoading(false);
        }
    };

    useEffect(() => {
        if (automaticRange) {
            fetchStats();
        }
    }, [automaticRange, currentTimestep, property, exposureId, symmetricRange]);

    useEffect(() => {
        if (symmetricRange && !automaticRange) {
            const limit = Math.max(Math.abs(startValue), Math.abs(endValue));
            setStartValue(-limit);
            setEndValue(limit);
        }
    }, [symmetricRange]);

    return (
        <EditorWidget className='color-coding-container overflow-hidden d-flex column gap-1' draggable={false}>
            <Container className='d-flex content-between items-center'>
                <Title className='font-weight-5-5'>Color Coding</Title>
            </Container>

            <Container className='d-flex column gap-1'>
                <FormField
                    fieldKey='property'
                    fieldType='select'
                    label='Property'
                    fieldValue={property}
                    onFieldChange={(_, v) => handlePropertyChange(v)}
                    options={propertyOptions}
                />

                <FormField
                    fieldKey='gradient'
                    fieldType='select'
                    label='Color Gradient'
                    fieldValue={gradient}
                    onFieldChange={(_, v) => setGradient(v)}
                    options={COLOR_GRADIENTS.map((color) => ({ value: color, title: color }))}
                />

                <FormField
                    fieldKey='startValue'
                    fieldType='input'
                    onFieldChange={(_, v) => setStartValue(v)}
                    fieldValue={startValue}
                    label='Start value'
                />

                <FormField
                    fieldKey='endValue'
                    onFieldChange={(_, v) => setEndValue(v)}
                    fieldValue={endValue}
                    fieldType='input'
                    label='End value'
                />

                <FormField
                    fieldKey='automaticRange'
                    fieldType='checkbox'
                    label='Automatic Range'
                    fieldValue={automaticRange}
                    onFieldChange={(_, v) => setAutomaticRange(v)}
                />
                <FormField
                    fieldKey='symmetricRange'
                    fieldType='checkbox'
                    label='Symmetric Range'
                    fieldValue={symmetricRange}
                    onFieldChange={(_, v) => setSymmetricRange(v)}
                />
            </Container>

            <Container className='color-coding-footer-container'>
                <Button
                    isLoading={isLoading}
                    variant='solid'
                    intent='brand'
                    block
                    onClick={applyColorCoding}
                    disabled={isLoading}
                >
                    Apply
                </Button>
            </Container>
        </EditorWidget>
    );
};

export default ColorCoding;
