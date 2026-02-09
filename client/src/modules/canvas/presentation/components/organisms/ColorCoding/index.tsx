import React from 'react';
import useColorCoding, { ColorGradient } from '../../../hooks/use-color-coding';
import GradientPreview from '../../atoms/GradientPreview';
import Button from '@/shared/presentation/components/Button';
import FormField from '@/shared/presentation/components/FormField';
import Container from '@/shared/presentation/components/Container';

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
    isApplying: boolean;
    canApply: boolean;
    onApply: () => void;
}

const ColorCodingForm = ({
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
    isApplying,
    canApply,
    onApply
}: ColorCodingFormProps) => {
    const selectFields: { key: string; label: string; value: string; onChange: (v: string) => void; options: { value: string; title: string }[] }[] = [
        { key: 'property', label: 'Property', value: property, onChange: onPropertyChange, options: propertyOptions },
        { key: 'gradient', label: 'Color Gradient', value: gradient, onChange: (v) => setGradient(v as ColorGradient), options: gradientOptions }
    ];

    const inputFields: { key: string; label: string; value: number; onChange: (v: number) => void }[] = [
        { key: 'startValue', label: 'Start value', value: startValue, onChange: setStartValue },
        { key: 'endValue', label: 'End value', value: endValue, onChange: setEndValue }
    ];

    const checkboxFields: { key: string; label: string; value: boolean; onChange: (v: boolean) => void }[] = [
        { key: 'automaticRange', label: 'Automatic Range', value: automaticRange, onChange: setAutomaticRange },
        { key: 'symmetricRange', label: 'Symmetric Range', value: symmetricRange, onChange: setSymmetricRange }
    ];

    return (
        <Container className="canvas-color-coding d-flex column gap-1">
            <Container className="d-flex column gap-1">
                {selectFields.map((f) => (
                    <FormField
                        key={f.key}
                        fieldKey={f.key}
                        fieldType="select"
                        label={f.label}
                        fieldValue={f.value}
                        onFieldChange={(_, value) => f.onChange(String(value))}
                        options={f.options}
                    />
                ))}

                <GradientPreview
                    gradient={gradient}
                    startValue={startValue}
                    endValue={endValue}
                />

                {inputFields.map((f) => (
                    <FormField
                        key={f.key}
                        fieldKey={f.key}
                        fieldType="input"
                        label={f.label}
                        fieldValue={f.value}
                        onFieldChange={(_, value) => f.onChange(Number(value))}
                    />
                ))}

                {checkboxFields.map((f) => (
                    <FormField
                        key={f.key}
                        fieldKey={f.key}
                        fieldType="checkbox"
                        label={f.label}
                        fieldValue={f.value}
                        onFieldChange={(_, value) => f.onChange(Boolean(value))}
                    />
                ))}
            </Container>

            <Container>
                <Button
                    isLoading={isApplying}
                    variant="solid"
                    intent="canvas"
                    shape="rounded"
                    block
                    onClick={onApply}
                    disabled={!canApply}
                    className="font-size-1"
                >
                    Apply
                </Button>
            </Container>
        </Container>
    );
};

const ColorCoding = ({ trajectoryId, analysisId, currentTimestep }: ColorCodingProps) => {
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
            isApplying={isApplying}
            canApply={canApply}
            onApply={applyColorCoding}
        />
    );
};

export default ColorCoding;
