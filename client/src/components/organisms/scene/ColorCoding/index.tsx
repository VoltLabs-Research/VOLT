import { useAnalysisConfigStore } from '@/stores/slices/analysis';
import { useEditorStore } from '@/stores/slices/editor';
import { useTrajectoryStore } from '@/stores/slices/trajectory';
import useFrameProperties from '@/hooks/trajectory/use-frame-properties';
import EditorWidget from '@/components/organisms/scene/EditorWidget';
import Button from '@/components/primitives/Button';
import FormField from '@/components/molecules/form/FormField';
import rasterApi from '@/services/api/raster/raster';
import { useState, useEffect } from 'react';
import Title from '@/components/primitives/Title';
import Container from '@/components/primitives/Container';
import './ColorCoding.css';

const COLOR_GRADIENTS = [
    'Viridis',
    'Blue-White-Red',
    'Cyclic-Rainbow',
    'Grayscale'
];

const ColorCoding = () => {
    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);
    const currentTimestep = useEditorStore((state) => state.currentTimestep);
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const setActiveScene = useEditorStore((state) => state.setActiveScene);
    const [property, setProperty] = useState('');
    const [exposureId, setExposureId] = useState<string | null>(null);
    const [startValue, setStartValue] = useState(0);
    const [endValue, setEndValue] = useState(0);
    const [gradient, setGradient] = useState('Viridis');
    const [automaticRange, setAutomaticRange] = useState(false);
    const [symmetricRange, setSymmetricRange] = useState(false);
    const { properties, isLoading } = useFrameProperties({
        analysisId: analysisConfig?._id,
        trajectoryId: trajectory?._id,
        frame: currentTimestep
    });

    const applyColorCoding = async () => {
        await rasterApi.colorCoding.apply(trajectory!._id, analysisConfig!._id, currentTimestep!, {
            property, startValue, endValue, gradient, exposureId: exposureId || undefined
        });
        setActiveScene({
            analysisId: analysisConfig?._id || '',
            endValue,
            exposureId: exposureId || undefined,
            gradient,
            property,
            source: 'color-coding',
            startValue
        } as any);
    };

    const propertyOptions = [
        ...properties.base.map((prop) => ({ value: prop, title: prop, exposureId: null })),
        ...Object.entries(properties.modifiers).flatMap(([expId, props]) =>
            props.map((prop) => ({ value: prop, title: prop, exposureId: expId }))
        )
    ];

    const handlePropertyChange = (value: string) => {
        setProperty(value);
        const selectedOption = propertyOptions.find((opt) => opt.value === value);
        setExposureId(selectedOption?.exposureId || null);
    };

    const fetchStats = async () => {
        if (!property || !trajectory?._id || !analysisConfig?._id) return;

        const selectedOption = propertyOptions.find(opt => opt.value === property);
        const type = selectedOption?.exposureId ? 'modifier' : 'base';

        try {
            const stats = await rasterApi.colorCoding.getStats(trajectory._id, analysisConfig._id, {
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
