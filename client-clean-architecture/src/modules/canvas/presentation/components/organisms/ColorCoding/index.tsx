import { memo } from 'react';
import useColorCoding, { ColorGradient } from '@/modules/canvas/presentation/hooks/use-color-coding';
import WidgetContainer from '@/modules/canvas/presentation/components/atoms/WidgetContainer';
import ModifierHeader from '@/modules/canvas/presentation/components/atoms/ModifierHeader';
import Button from '@/shared/presentation/components/Button';
import FormField from '@/shared/presentation/components/FormField';
import Loader from '@/shared/presentation/components/Loader';
import Container from '@/shared/presentation/components/Container';
import GradientPreview from '@/modules/canvas/presentation/components/atoms/GradientPreview';
import '@/modules/canvas/presentation/components/organisms/ColorCoding/ColorCoding.css';

interface ColorCodingProps {
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
}

interface ColorCodingFormProps {
    property: string;
    propertyOptions: { value: string; title: string }[];
    onPropertyChange: (value: string) => void;
    gradient: ColorGradient;
    setGradient: (g: ColorGradient) => void;
    gradientOptions: { value: string; title: string }[];
    startValue: number;
    setStartValue: (v: number) => void;
    endValue: number;
    setEndValue: (v: number) => void;
    automaticRange: boolean;
    setAutomaticRange: (v: boolean) => void;
    symmetricRange: boolean;
    setSymmetricRange: (v: boolean) => void;
    isFetchingStats: boolean;
    isApplying: boolean;
    canApply: boolean;
    onApply: () => void;
}

const ColorCodingForm = memo(({
    property,
    propertyOptions,
    onPropertyChange,
    gradient,
    setGradient,
    gradientOptions,
    startValue,
    setStartValue,
    endValue,
    setEndValue,
    automaticRange,
    setAutomaticRange,
    symmetricRange,
    setSymmetricRange,
    isFetchingStats,
    isApplying,
    canApply,
    onApply
}: ColorCodingFormProps) => (
    <WidgetContainer className='color-coding-container p-1 overflow-hidden d-flex column gap-1'>
        <ModifierHeader title='Color Coding' modifierId='color-coding'>
            {isFetchingStats && <Loader scale={0.5} isFixed={false} />}
        </ModifierHeader>

        <Container className='d-flex column gap-1'>
            <FormField
                fieldKey='property'
                fieldType='select'
                label='Property'
                fieldValue={property}
                onFieldChange={(_, value) => onPropertyChange(String(value))}
                options={propertyOptions}
            />

            <FormField
                fieldKey='gradient'
                fieldType='select'
                label='Color Gradient'
                fieldValue={gradient}
                onFieldChange={(_, value) => setGradient(value as ColorGradient)}
                options={gradientOptions}
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
                onClick={onApply}
                disabled={!canApply}
            >
                Apply
            </Button>
        </Container>
    </WidgetContainer>
));
ColorCodingForm.displayName = 'ColorCodingForm';

const ColorCoding = memo(({
    trajectoryId,
    analysisId,
    currentTimestep
}: ColorCodingProps) => {
    const {
        property,
        propertyOptions,
        handlePropertyChange,
        gradient,
        setGradient,
        gradientOptions,
        startValue,
        setStartValue,
        endValue,
        setEndValue,
        automaticRange,
        setAutomaticRange,
        symmetricRange,
        setSymmetricRange,
        isFetchingStats,
        isApplying,
        canApply,
        applyColorCoding
    } = useColorCoding({ trajectoryId, analysisId, currentTimestep });

    return (
        <ColorCodingForm
            property={property}
            propertyOptions={propertyOptions}
            onPropertyChange={handlePropertyChange}
            gradient={gradient}
            setGradient={setGradient}
            gradientOptions={gradientOptions}
            startValue={startValue}
            setStartValue={setStartValue}
            endValue={endValue}
            setEndValue={setEndValue}
            automaticRange={automaticRange}
            setAutomaticRange={setAutomaticRange}
            symmetricRange={symmetricRange}
            setSymmetricRange={setSymmetricRange}
            isFetchingStats={isFetchingStats}
            isApplying={isApplying}
            canApply={canApply}
            onApply={applyColorCoding}
        />
    );
});

ColorCoding.displayName = 'ColorCoding';

export default ColorCoding;
