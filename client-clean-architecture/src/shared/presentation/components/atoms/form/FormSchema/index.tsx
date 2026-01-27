import React from 'react';
import FormSection from '@/shared/presentation/components/atoms/form/FormSection';
import FormRow from '@/shared/presentation/components/atoms/form/FormRow';

type BaseRow = {
    label: string;
    min: number;
    max: number;
    step: number;
    format?: (v: number) => string;
    className?: string;
};

export type SliderRowDef =
    | (BaseRow & { get: () => number; set: (v: number) => void })
    | (BaseRow & { value: number; onChange: (v: number) => void });

export type SectionDef = {
    key: string;
    title: string;
    enabled: boolean;
    onToggle?: (enabled: boolean) => void;
    rows: SliderRowDef[];
    extras?: React.ReactNode;
};

export interface FormSchemaProps {
    sections: SectionDef[];
    className?: string;
}

const FormSchema: React.FC<FormSchemaProps> = ({ sections, className }) => {
    return(
        <div className={className}>
            {sections.map((s) => (
                <FormSection
                    key={s.key}
                    title={s.title}
                    enabled={s.enabled}
                    onToggle={s.onToggle ?? (() => {})}
                >
                    {s.rows.map((r) => {
                        const value = 'get' in r ? r.get() : r.value;
                        const onChange = 'set' in r ? r.set : r.onChange;

                        return(
                            <FormRow
                                key={`${s.key}-${r.label}`}
                                label={r.label}
                                min={r.min}
                                max={r.max}
                                step={r.step}
                                value={value}
                                onChange={onChange}
                                format={r.format}
                                className={r.className}
                            />
                        );
                    })}
                    {s.extras}
                </FormSection>
            ))}
        </div>
    );
};

export default FormSchema;
