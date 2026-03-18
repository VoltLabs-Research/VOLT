import { ColorGradient } from '../../../hooks/use-color-coding';
import useColorCoding from '../../../hooks/use-color-coding';
import GradientPreview from '../../atoms/GradientPreview';
import { ExecState } from '../../../hooks/use-plugin-execution';

import { memo, useEffect } from 'react';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';

import type { MutableRefObject } from 'react';

interface SelectOption {
    value: string;
    title: string;
};

interface SelectFieldConfig {
    key: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
};

interface NumberFieldConfig {
    key: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
};

interface BooleanFieldConfig {
    key: string;
    label: string;
    value: boolean;
    onChange: (value: boolean) => void;
};

export interface LegacyActionRef {
    actions: MutableRefObject<Map<string, () => void>>;
    notifyExecState: (id: string, state: ExecState) => void;
};

interface ColorCodingProps {
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
    legacyRef?: LegacyActionRef;
};

interface ColorCodingFormProps {
    propertyValue: string;
    propertyOptions: SelectOption[];
    onPropertyChange: (value: string) => void;
    gradient: ColorGradient;
    setGradient: (gradient: ColorGradient) => void;
    gradientOptions: SelectOption[];
    startValue: number;
    startValueInput: string;
    setStartValue: (value: string) => void;
    endValue: number;
    endValueInput: string;
    setEndValue: (value: string) => void;
    automaticRange: boolean;
    setAutomaticRange: (value: boolean) => void;
    symmetricRange: boolean;
    setSymmetricRange: (value: boolean) => void;
};

const ColorCodingForm = ({
    propertyValue,
    propertyOptions,
    onPropertyChange,
    gradient,
    setGradient,
    gradientOptions,
    startValue,
    startValueInput,
    setStartValue,
    endValue,
    endValueInput,
    setEndValue,
    automaticRange,
    setAutomaticRange,
    symmetricRange,
    setSymmetricRange
}: ColorCodingFormProps) => {
    const handleGradientChange = (value: string) => {
        setGradient(value as ColorGradient);
    };

    const selectFields: SelectFieldConfig[] = [
        {
            key: 'property',
            label: 'Property',
            value: propertyValue,
            onChange: onPropertyChange,
            options: propertyOptions
        },
        {
            key: 'gradient',
            label: 'Color Gradient',
            value: gradient,
            onChange: handleGradientChange,
            options: gradientOptions
        }
    ];

    const inputFields: NumberFieldConfig[] = [
        {
            key: 'startValue',
            label: 'Start value',
            value: startValueInput,
            onChange: setStartValue
        },
        {
            key: 'endValue',
            label: 'End value',
            value: endValueInput,
            onChange: setEndValue
        }
    ];

    const checkboxFields: BooleanFieldConfig[] = [
        {
            key: 'automaticRange',
            label: 'Automatic Range',
            value: automaticRange,
            onChange: setAutomaticRange
        },
        {
            key: 'symmetricRange',
            label: 'Symmetric Range',
            value: symmetricRange,
            onChange: setSymmetricRange
        }
    ];

    return (
        <Container className="canvas-color-coding d-flex column gap-05">
            <Container className="d-flex column gap-05">
                {selectFields.map((field) => (
                    <FormFieldRHF
                        key={field.key}
                        fieldKey={field.key}
                        fieldType="select"
                        label={field.label}
                        fieldValue={field.value}
                        onFieldChange={(_, value) => field.onChange(String(value))}
                        options={field.options}
                        variant="canvas"
                    />
                ))}

                <GradientPreview
                    gradient={gradient}
                    startValue={startValue}
                    endValue={endValue}
                />

                {inputFields.map((field) => (
                    <FormFieldRHF
                        key={field.key}
                        fieldKey={field.key}
                        fieldType="input"
                        label={field.label}
                        fieldValue={field.value}
                        onFieldChange={(_, value) => field.onChange(String(value))}
                        inputProps={{ inputMode: 'decimal' }}
                        variant="canvas"
                    />
                ))}

                {checkboxFields.map((field) => (
                    <FormFieldRHF
                        key={field.key}
                        fieldKey={field.key}
                        fieldType="checkbox"
                        label={field.label}
                        fieldValue={field.value}
                        onFieldChange={(_, value) => field.onChange(Boolean(value))}
                        variant="canvas"
                    />
                ))}
            </Container>
        </Container>
    );
};

const ColorCoding = ({ trajectoryId, analysisId, currentTimestep, legacyRef }: ColorCodingProps) => {
    const {
        propertyValue,
        propertyOptions,
        handlePropertyChange,
        gradient,
        setGradient,
        gradientOptions,
        startValue,
        startValueInput,
        setStartValue,
        endValue,
        endValueInput,
        setEndValue,
        automaticRange,
        setAutomaticRange,
        symmetricRange,
        setSymmetricRange,
        isApplying,
        canApply,
        applyColorCoding
    } = useColorCoding({
        trajectoryId,
        analysisId,
        currentTimestep
    });

    useEffect(() => {
        if (!legacyRef) return;

        let action = () => {};
        if (canApply) {
            action = applyColorCoding;
        }

        legacyRef.actions.current.set('color-coding', action);
        return () => {
            legacyRef.actions.current.delete('color-coding');
        };
    }, [legacyRef, applyColorCoding, canApply]);

    useEffect(() => {
        if (!legacyRef) return;
        legacyRef.notifyExecState('color-coding', isApplying ? ExecState.Loading : ExecState.Idle);
    }, [legacyRef, isApplying]);

    return (
        <ColorCodingForm
            propertyValue={propertyValue}
            propertyOptions={propertyOptions}
            onPropertyChange={handlePropertyChange}
            gradient={gradient}
            setGradient={setGradient}
            gradientOptions={gradientOptions}
            startValue={startValue}
            startValueInput={startValueInput}
            setStartValue={setStartValue}
            endValue={endValue}
            endValueInput={endValueInput}
            setEndValue={setEndValue}
            automaticRange={automaticRange}
            setAutomaticRange={setAutomaticRange}
            symmetricRange={symmetricRange}
            setSymmetricRange={setSymmetricRange}
        />
    );
};

export default memo(ColorCoding);
