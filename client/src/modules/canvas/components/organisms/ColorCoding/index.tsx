import { memo, useEffect, type MutableRefObject } from 'react';
import useColorCoding, { ColorGradient } from '../../../hooks/use-color-coding';
import GradientPreview from '../../atoms/GradientPreview';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Container from '@/shared/presentation/components/Container';
import type { ExecState } from '../../../hooks/use-plugin-execution';

export interface LegacyActionRef {
    actions: MutableRefObject<Map<string, () => void>>;
    notifyExecState: (id: string, state: ExecState) => void;
}

interface ColorCodingProps {
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
    legacyRef?: LegacyActionRef;
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
    setSymmetricRange
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
        <Container className="canvas-color-coding d-flex column gap-05">
            <Container className="d-flex column gap-05">
                {selectFields.map((f) => (
                    <FormFieldRHF
                        key={f.key}
                        fieldKey={f.key}
                        fieldType="select"
                        label={f.label}
                        fieldValue={f.value}
                        onFieldChange={(_, value) => f.onChange(String(value))}
                        options={f.options}
                        variant="canvas"
                    />
                ))}

                <GradientPreview
                    gradient={gradient}
                    startValue={startValue}
                    endValue={endValue}
                />

                {inputFields.map((f) => (
                    <FormFieldRHF
                        key={f.key}
                        fieldKey={f.key}
                        fieldType="input"
                        label={f.label}
                        fieldValue={f.value}
                        onFieldChange={(_, value) => f.onChange(Number(value))}
                        variant="canvas"
                    />
                ))}

                {checkboxFields.map((f) => (
                    <FormFieldRHF
                        key={f.key}
                        fieldKey={f.key}
                        fieldType="checkbox"
                        label={f.label}
                        fieldValue={f.value}
                        onFieldChange={(_, value) => f.onChange(Boolean(value))}
                        variant="canvas"
                    />
                ))}
            </Container>
        </Container>
    );
};

const ColorCoding = ({ trajectoryId, analysisId, currentTimestep, legacyRef }: ColorCodingProps) => {
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

    useEffect(() => {
        if (!legacyRef) return;
        legacyRef.actions.current.set('color-coding', canApply ? applyColorCoding : () => {});
        return () => { legacyRef.actions.current.delete('color-coding'); };
    }, [legacyRef, applyColorCoding, canApply]);

    useEffect(() => {
        if (!legacyRef) return;
        legacyRef.notifyExecState('color-coding', isApplying ? 'loading' : 'idle');
    }, [legacyRef, isApplying]);

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
        />
    );
};

export default memo(ColorCoding);
