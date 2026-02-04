import React, { memo } from 'react';
import FormSection from '@/modules/canvas/presentation/components/atoms/form/FormSection';
import FormRow from '@/modules/canvas/presentation/components/atoms/form/FormRow';

type BaseRow = {
    label: string;
    min: number;
    max: number;
    step: number;
    format?: (value: number) => string;
    className?: string;
};

export type SliderRowDef =
    | (BaseRow & { get: () => number; set: (value: number) => void })
    | (BaseRow & { value: number; onChange: (value: number) => void });

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
    return (
        <div className={className}>
            {sections.map((section) => (
                <FormSection
                    key={section.key}
                    title={section.title}
                    enabled={section.enabled}
                    onToggle={section.onToggle ?? (() => {})}
                >
                    {section.rows.map((row) => {
                        const value = 'get' in row ? row.get() : row.value;
                        const onChange = 'set' in row ? row.set : row.onChange;

                        return (
                            <FormRow
                                key={`${section.key}-${row.label}`}
                                label={row.label}
                                min={row.min}
                                max={row.max}
                                step={row.step}
                                value={value}
                                onChange={onChange}
                                format={row.format}
                                className={row.className}
                            />
                        );
                    })}
                    {section.extras}
                </FormSection>
            ))}
        </div>
    );
};

export default memo(FormSchema);
