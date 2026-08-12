import CanvasOptionSelect from '@/modules/canvas/components/CanvasOptionSelect';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';

import type { ReactNode } from 'react';
import type { SelectOption } from '@/modules/canvas/contracts/select-option';


type RowDef = {
    label: string;
    min: number;
    max: number;
    step: number;
    decimals?: number;
    className?: string;
};

type ValueRowDef = RowDef & {
    value: number;
    onChange: (value: number) => void;
};

export const PRESETS = {
    intensity: (max = 10): RowDef => ({
        label: 'Intensity',
        min: 0,
        max,
        step: 0.01,
        decimals: 2
    }),
    distance: {
        label: 'Distance',
        min: 0,
        max: 5000,
        step: 0.1,
        decimals: 1
    } satisfies RowDef,
    decay: {
        label: 'Decay',
        min: 0,
        max: 4,
        step: 0.1,
        decimals: 2
    } satisfies RowDef,
    angle: {
        label: 'Angle',
        min: 0,
        max: Math.PI / 2,
        step: 0.01,
        decimals: 2
    } satisfies RowDef,
    penumbra: {
        label: 'Penumbra',
        min: 0,
        max: 1,
        step: 0.01,
        decimals: 2
    } satisfies RowDef,
    width: {
        label: 'Width',
        min: 0.1,
        max: 1000,
        step: 0.1,
        decimals: 1
    } satisfies RowDef,
    height: {
        label: 'Height',
        min: 0.1,
        max: 1000,
        step: 0.1,
        decimals: 1
    } satisfies RowDef,
    speed: (label: string, max = 10): RowDef => ({
        label,
        min: 0,
        max,
        step: 0.1,
        decimals: 1
    }),
    factor: (label: string): RowDef => ({
        label,
        min: 0,
        max: 1,
        step: 0.01,
        decimals: 2
    }),
    cellSize: {
        label: 'Cell Size',
        min: 0.1,
        max: 100,
        step: 0.1,
        decimals: 1
    } satisfies RowDef,
    sectionSize: {
        label: 'Section Size',
        min: 0.1,
        max: 500,
        step: 0.1,
        decimals: 1
    } satisfies RowDef,
    thickness: (label: string): RowDef => ({
        label,
        min: 0.1,
        max: 10,
        step: 0.1,
        decimals: 1
    }),
    fadeDistance: {
        label: 'Fade Distance',
        min: 1,
        max: 1000,
        step: 1,
        decimals: 0
    } satisfies RowDef,
    fadeStrength: {
        label: 'Fade Strength',
        min: 0,
        max: 1,
        step: 0.01,
        decimals: 2
    } satisfies RowDef
};

export const row = (
    base: RowDef,
    get: () => number,
    set: (value: number) => void
) => ({
    label: base.label,
    min: base.min,
    max: base.max,
    step: base.step,
    format: (value: number) => base.decimals !== undefined ? value.toFixed(base.decimals) : String(value),
    className: base.className,
    get,
    set
});

export const valueRow = (def: ValueRowDef) => ({
    label: def.label,
    min: def.min,
    max: def.max,
    step: def.step,
    format: (value: number) => def.decimals !== undefined ? value.toFixed(def.decimals) : String(value),
    className: def.className,
    value: def.value,
    onChange: def.onChange
});

export const positionRows = (get: () => number[], setAt: (index: number, value: number) => void) => (
    ['X', 'Y', 'Z'].map((axis, index) => row(
        {
            label: `Pos ${axis}`,
            min: -1000,
            max: 1000,
            step: 0.1,
            decimals: 2
        },
        () => get()[index],
        (value) => setAt(index, value)
    ))
);

export const vec3Rows = (
    labelPrefix: string,
    get: () => number[],
    setAt: (index: number, value: number) => void,
    overrides?: Partial<RowDef>
) => (
    ['X', 'Y', 'Z'].map((axis, index) => row({
        label: `${labelPrefix} ${axis}`,
        min: overrides?.min ?? -1,
        max: overrides?.max ?? 1,
        step: overrides?.step ?? 0.01,
        decimals: overrides?.decimals ?? 2
    }, () => get()[index], (value) => setAt(index, value)))
);

export const targetRows = (get: () => number[], set: (value: [number, number, number]) => void) => (
    ['X', 'Y', 'Z'].map((axis, index) => row(
        {
            label: `Target ${axis}`,
            min: -1000,
            max: 1000,
            step: 0.1,
            decimals: 2
        },
        () => get()[index],
        (value) => {
            const next = [...get()] as [number, number, number];
            next[index] = value;
            set(next);
        }
    ))
);

export const gridPosRows = (get: () => number[], set: (value: [number, number, number]) => void) => (
    vec3Rows('Pos', get, (index, value) => {
        const next = [...get()] as [number, number, number];
        next[index] = value;
        set(next);
    }, {
        min: -1000,
        max: 1000,
        step: 0.1,
        decimals: 2
    })
);

export const gridRotRows = (get: () => number[], set: (value: [number, number, number]) => void) => (
    vec3Rows('Rot', get, (index, value) => {
        const next = [...get()] as [number, number, number];
        next[index] = value;
        set(next);
    }, {
        min: -Math.PI,
        max: Math.PI,
        step: 0.01,
        decimals: 2
    })
);

export const checkbox = (
    key: string,
    label: string,
    value: boolean,
    onChange: (value: boolean) => void
): ReactNode => (
    <div className='canvas-form-section flex flex-col gap-2 [&_.form-field-container]:min-h-6 [&_.form-field-container]:w-full [&_.form-field-container]:flex-row [&_.form-field-container]:items-center [&_.form-field-container]:justify-between [&_.form-field-container]:gap-2 [&_.form-field-container>label]:min-w-0 [&_.form-field-container>label]:flex-auto [&_.form-field-container>label]:text-2xs [&_.form-field-container>label]:text-muted [&_.form-field-container>.relative]:flex-none [&_.labeled-input-color]:h-[22px] [&_.labeled-input-color]:w-8 [&_.labeled-input-color]:cursor-pointer [&_.labeled-input-color]:rounded-lg [&_.labeled-input-color]:border [&_.labeled-input-color]:border-border [&_.labeled-input-color]:bg-transparent [&_.labeled-input-color]:p-0' key={key}>
        <FormFieldRHF
            fieldKey={key}
            fieldType="checkbox"
            label={label}
            fieldValue={value}
            onFieldChange={(_, next) => onChange(Boolean(next))}
        />
    </div>
);

export const checkboxGrid = (items: Array<{ key: string; label: string; value: boolean; onChange: (value: boolean) => void }>): ReactNode => (
    <div className='flex flex-col gap-2'>
        {items.map((item) => checkbox(item.key, item.label, item.value, item.onChange))}
    </div>
);

export const colorField = (
    key: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    description?: string
): ReactNode => (
    <div className='canvas-form-section flex flex-col gap-2 [&_.form-field-container]:min-h-6 [&_.form-field-container]:w-full [&_.form-field-container]:flex-row [&_.form-field-container]:items-center [&_.form-field-container]:justify-between [&_.form-field-container]:gap-2 [&_.form-field-container>label]:min-w-0 [&_.form-field-container>label]:flex-auto [&_.form-field-container>label]:text-2xs [&_.form-field-container>label]:text-muted [&_.form-field-container>.relative]:flex-none [&_.labeled-input-color]:h-[22px] [&_.labeled-input-color]:w-8 [&_.labeled-input-color]:cursor-pointer [&_.labeled-input-color]:rounded-lg [&_.labeled-input-color]:border [&_.labeled-input-color]:border-border [&_.labeled-input-color]:bg-transparent [&_.labeled-input-color]:p-0' key={key}>
        <FormFieldRHF
            fieldKey={key}
            fieldType="color"
            label={label}
            fieldValue={value}
            onFieldChange={(_, next) => onChange(String(next))}
        />
        {description && (
            <div className='flex flex-col gap-2'>
                <span className='text-xs text-muted'>{description}</span>
            </div>
        )}
    </div>
);

export const colorExtras = (
    color: { key: string; label: string; value: string; onChange: (value: string) => void },
    toggles: Array<{ key: string; label: string; value: boolean; onChange: (value: boolean) => void }>
): ReactNode => (
    <div className='flex flex-col gap-2'>
        {colorField(color.key, color.label, color.value, color.onChange)}
        {toggles.length > 0 && checkboxGrid(toggles)}
    </div>
);

export const selectField = (
    key: string,
    value: string,
    onChange: (value: string) => void,
    placeholder: string,
    options: SelectOption[]
): ReactNode => (
    <div className='flex flex-col gap-1' key={key}>
        <CanvasOptionSelect
            ariaLabel={placeholder}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            options={options}
            size='compact'
        />
    </div>
);
