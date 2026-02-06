import type { ReactNode } from 'react';
import FormField from '@/shared/presentation/components/FormField';
import type { SliderRowDef } from '@/modules/canvas/presentation/components/atoms/form/FormSchema';

// Row definition helper
type RowConfig = {
    label: string;
    min: number;
    max: number;
    step: number;
    decimals?: number;
};

// Create a single slider row (get/set pattern)
export const row = (
    config: RowConfig,
    get: () => number,
    set: (v: number) => void
): SliderRowDef => ({
    label: config.label,
    min: config.min,
    max: config.max,
    step: config.step,
    get,
    set,
    format: (v) => v.toFixed(config.decimals ?? 2)
});

// Slider row with value/onChange pattern (for EffectsControls style)
type ValueRowConfig = RowConfig & { value: number; onChange: (v: number) => void };
export const valueRow = (config: ValueRowConfig) => ({
    label: config.label,
    min: config.min,
    max: config.max,
    step: config.step,
    value: config.value,
    onChange: config.onChange,
    format: (v: number) => v.toFixed(config.decimals ?? 2)
});

// Common presets for reusable configurations
export const PRESETS = {
    intensity: (max = 10) => ({ label: 'Intensity', min: 0, max, step: 0.01, decimals: 2 }),
    posX: { label: 'Pos X', min: -1000, max: 1000, step: 0.1, decimals: 1 },
    posY: { label: 'Pos Y', min: -1000, max: 1000, step: 0.1, decimals: 1 },
    posZ: { label: 'Pos Z', min: -1000, max: 1000, step: 0.1, decimals: 1 },
    distance: { label: 'Distance', min: 0, max: 1000, step: 0.1, decimals: 1 },
    decay: { label: 'Decay', min: 0, max: 5, step: 0.01, decimals: 2 },
    angle: { label: 'Angle', min: 0.01, max: Math.PI / 2, step: 0.01, decimals: 2 },
    penumbra: { label: 'Penumbra', min: 0, max: 1, step: 0.01, decimals: 2 },
    width: { label: 'Width', min: 0.1, max: 100, step: 0.1, decimals: 1 },
    height: { label: 'Height', min: 0.1, max: 100, step: 0.1, decimals: 1 },
    // Grid presets
    cellSize: { label: 'Cell Size', min: 0.1, max: 5, step: 0.1, decimals: 1 },
    sectionSize: { label: 'Section Size', min: 1, max: 20, step: 0.5, decimals: 1 },
    thickness: (label: string) => ({ label, min: 0.1, max: 3, step: 0.1, decimals: 1 }),
    fadeDistance: { label: 'Fade Distance', min: 10, max: 500, step: 10, decimals: 0 },
    fadeStrength: { label: 'Fade Strength', min: 0.1, max: 10, step: 0.1, decimals: 1 },
    // Transform presets
    gridPos: (axis: string) => ({ label: `Position ${axis}`, min: -50, max: 50, step: 0.1, decimals: 1 }),
    rotation: (axis: string) => ({ label: `Rotation ${axis}(rad)`, min: -Math.PI, max: Math.PI, step: 0.1, decimals: 2 }),
    // Speed presets
    speed: (label: string, max = 10) => ({ label, min: 0.01, max, step: 0.01, decimals: 2 }),
    factor: (label: string) => ({ label, min: 0, max: 1, step: 0.001, decimals: 3 }),
    // DPR presets
    dpr: (label: string) => ({ label, min: 0.5, max: 3, step: 0.05, decimals: 2 }),
    debounce: (label: string, max = 300) => ({ label, min: 0, max, step: 5, decimals: 0 }),
    perf: (label: string) => ({ label, min: 0.1, max: 1, step: 0.05, decimals: 2 }),
} as const;

// Position rows helper (x, y, z)
export const positionRows = (
    pos: () => number[],
    setPos: (axis: number, v: number) => void
): SliderRowDef[] => [
    row(PRESETS.posX, () => pos()[0], (v) => setPos(0, v)),
    row(PRESETS.posY, () => pos()[1], (v) => setPos(1, v)),
    row(PRESETS.posZ, () => pos()[2], (v) => setPos(2, v)),
];

// Vector3 rows helper with custom labels
export const vec3Rows = (
    prefix: string,
    vec: () => number[],
    setVec: (axis: number, v: number) => void,
    config: Omit<RowConfig, 'label'> = { min: -1000, max: 1000, step: 0.1, decimals: 1 }
): SliderRowDef[] => ['X', 'Y', 'Z'].map((axis, i) => 
    row({ ...config, label: `${prefix} ${axis}` }, () => vec()[i], (v) => setVec(i, v))
);

// Generic tuple rows - unified helper for position, rotation, target, etc.
type TupleRowsConfig = {
    prefix: string;
    get: () => number[];
    set: (tuple: [number, number, number]) => void;
    config?: Omit<RowConfig, 'label'>;
    axes?: string[];
};

export const tupleRows = ({
    prefix,
    get,
    set,
    config = { min: -1000, max: 1000, step: 0.1, decimals: 1 },
    axes = ['X', 'Y', 'Z']
}: TupleRowsConfig): SliderRowDef[] => axes.map((axis, i) => 
    row({ ...config, label: `${prefix} ${axis}` }, () => get()[i], (v) => {
        const arr = [...get()] as [number, number, number];
        arr[i] = v;
        set(arr);
    })
);

// Convenience aliases using tupleRows
export const gridPosRows = (pos: () => number[], setPos: (p: [number, number, number]) => void) =>
    tupleRows({ prefix: 'Position', get: pos, set: setPos, config: { min: -50, max: 50, step: 0.1, decimals: 1 } });

export const gridRotRows = (rot: () => number[], setRot: (r: [number, number, number]) => void) =>
    tupleRows({ prefix: 'Rotation', get: rot, set: setRot, config: { min: -Math.PI, max: Math.PI, step: 0.1, decimals: 2 }, axes: ['X(rad)', 'Y(rad)', 'Z(rad)'] });

export const targetRows = (target: () => number[], setTarget: (t: [number, number, number]) => void) =>
    tupleRows({ prefix: 'Target', get: target, set: setTarget, config: { min: -100000, max: 100000, step: 0.1, decimals: 2 } });

// Color + checkboxes extras helper
type CheckboxConfig = { key: string; label: string; value: boolean; onChange: (v: boolean) => void };
type ColorConfig = { key: string; label: string; value: string; onChange: (v: string) => void };

export const colorExtras = (
    color: ColorConfig,
    checkboxes: CheckboxConfig[] = []
): ReactNode => (
    <div className='d-flex column gap-05'>
        <FormField
            fieldKey={color.key}
            label={color.label}
            fieldType='color'
            fieldValue={color.value}
            onFieldChange={(_, v) => color.onChange(String(v))}
        />
        {checkboxes.map(cb => (
            <FormField
                key={cb.key}
                fieldKey={cb.key}
                label={cb.label}
                fieldType='checkbox'
                fieldValue={cb.value}
                onFieldChange={(_, v) => cb.onChange(!!v)}
            />
        ))}
    </div>
);

// Section builder helper
type SectionConfig<T> = {
    key: string;
    title: string;
    data: T;
    enabled?: boolean | ((data: T) => boolean);
    onToggle?: (enabled: boolean) => void;
    rows: (data: T) => SliderRowDef[];
    extras?: (data: T) => ReactNode;
};

export const buildSection = <T,>(config: SectionConfig<T>) => {
    const enabled = typeof config.enabled === 'function' 
        ? config.enabled(config.data) 
        : config.enabled ?? true;
    
    return {
        key: config.key,
        title: config.title,
        enabled,
        onToggle: config.onToggle,
        rows: config.rows(config.data),
        extras: config.extras?.(config.data)
    };
};

// Checkbox with description helper
export const checkboxWithDesc = (
    key: string,
    label: string,
    description: string,
    value: boolean,
    onChange: (v: boolean) => void
): ReactNode => (
    <div>
        <FormField
            fieldKey={key}
            label={label}
            fieldType='checkbox'
            fieldValue={value}
            onFieldChange={(_, v) => onChange(Boolean(v))}
        />
        <div className='font-size-1 color-muted mt-05'>{description}</div>
    </div>
);

// Simple checkbox helper (no description)
export const checkbox = (
    key: string,
    label: string,
    value: boolean,
    onChange: (v: boolean) => void
): ReactNode => (
    <FormField
        fieldKey={key}
        label={label}
        fieldType='checkbox'
        fieldValue={value}
        onFieldChange={(_, v) => onChange(Boolean(v))}
    />
);

// Multiple checkboxes in a grid
export const checkboxGrid = (
    checkboxes: Array<{ key: string; label: string; value: boolean; onChange: (v: boolean) => void }>
): ReactNode => (
    <div className='d-flex column gap-05'>
        {checkboxes.map(cb => (
            <FormField
                key={cb.key}
                fieldKey={cb.key}
                label={cb.label}
                fieldType='checkbox'
                fieldValue={cb.value}
                onFieldChange={(_, v) => cb.onChange(Boolean(v))}
            />
        ))}
    </div>
);

// Color field helper
export const colorField = (
    key: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    description?: string
): ReactNode => (
    <div>
        <FormField
            fieldKey={key}
            label={label}
            fieldType='color'
            fieldValue={value}
            onFieldChange={(_, v) => onChange(String(v))}
        />
        {description && <div className='font-size-1 color-muted mt-05'>{description}</div>}
    </div>
);

// Select with description helper
// Note: This helper is not currently used, keeping for potential future use
type SelectOption = { title: string; value: string; description?: string };
export const selectWithDesc = (
    SelectComponent: React.ComponentType<{ value: string; onChange: (v: string) => void; placeholder: string; options: SelectOption[] }>,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    options: SelectOption[],
    description?: string
): ReactNode => (
    <div>
        <SelectComponent value={value} onChange={onChange} placeholder={placeholder} options={options} />
        {description && <div className='font-size-1 color-muted mt-05'>{description}</div>}
    </div>
);

// Warning banner helper
export const warningBanner = (message: string): ReactNode => (
    <div className='font-size-1 p-05 radius-sm' style={{ color: '#ffa500', marginBottom: '8px', background: 'rgba(255, 165, 0, 0.1)' }}>
        {message}
    </div>
);

// Slider with description helper
export const sliderWithDesc = (
    label: string,
    description: string,
    value: number,
    onChange: (v: number) => void,
    config: { min: number; max: number; step: number; decimals?: number }
): ReactNode => (
    <div>
        <div className='d-flex items-center content-between'>
            <label className='labeled-input-label font-weight-4'>{label}</label>
            <div className='form-control-row-slider-container'>
                <input
                    type='range'
                    min={config.min}
                    max={config.max}
                    step={config.step}
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    className='w-max'
                />
                <span className='form-control-value color-muted'>
                    {value.toFixed(config.decimals ?? 2)}
                </span>
            </div>
        </div>
        <div className='font-size-1 color-muted mt-05'>{description}</div>
    </div>
);
