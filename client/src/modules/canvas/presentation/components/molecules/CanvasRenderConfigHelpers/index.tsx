import FormField from '@/shared/presentation/components/FormField';
import Slider from '@/shared/presentation/components/Slider';
import Select from '@/shared/presentation/components/Select';
import type { ReactNode } from 'react';
import Container from '@/shared/presentation/components/Container';

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
    intensity: (max = 10): RowDef => ({ label: 'Intensity', min: 0, max, step: 0.01, decimals: 2 }),
    distance: { label: 'Distance', min: 0, max: 5000, step: 0.1, decimals: 1 } satisfies RowDef,
    decay: { label: 'Decay', min: 0, max: 4, step: 0.1, decimals: 2 } satisfies RowDef,
    angle: { label: 'Angle', min: 0, max: Math.PI / 2, step: 0.01, decimals: 2 } satisfies RowDef,
    penumbra: { label: 'Penumbra', min: 0, max: 1, step: 0.01, decimals: 2 } satisfies RowDef,
    width: { label: 'Width', min: 0.1, max: 1000, step: 0.1, decimals: 1 } satisfies RowDef,
    height: { label: 'Height', min: 0.1, max: 1000, step: 0.1, decimals: 1 } satisfies RowDef,
    dpr: (label = 'DPR'): RowDef => ({ label, min: 0.25, max: 3, step: 0.05, decimals: 2 }),
    perf: (label: string): RowDef => ({ label, min: 0.1, max: 10, step: 0.1, decimals: 1 }),
    debounce: (label: string, max = 2000): RowDef => ({ label, min: 0, max, step: 10, decimals: 0 }),
    speed: (label: string, max = 10): RowDef => ({ label, min: 0, max, step: 0.1, decimals: 1 }),
    factor: (label: string): RowDef => ({ label, min: 0, max: 1, step: 0.01, decimals: 2 }),
    cellSize: { label: 'Cell Size', min: 0.1, max: 100, step: 0.1, decimals: 1 } satisfies RowDef,
    sectionSize: { label: 'Section Size', min: 0.1, max: 500, step: 0.1, decimals: 1 } satisfies RowDef,
    thickness: (label: string): RowDef => ({ label, min: 0.1, max: 10, step: 0.1, decimals: 1 }),
    fadeDistance: { label: 'Fade Distance', min: 1, max: 1000, step: 1, decimals: 0 } satisfies RowDef,
    fadeStrength: { label: 'Fade Strength', min: 0, max: 1, step: 0.01, decimals: 2 } satisfies RowDef
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
    format: (value: number) => typeof base.decimals === 'number' ? value.toFixed(base.decimals) : String(value),
    className: base.className,
    get,
    set
});

export const valueRow = (def: ValueRowDef) => ({
    label: def.label,
    min: def.min,
    max: def.max,
    step: def.step,
    format: (value: number) => typeof def.decimals === 'number' ? value.toFixed(def.decimals) : String(value),
    className: def.className,
    value: def.value,
    onChange: def.onChange
});

export const positionRows = (get: () => number[], setAt: (index: number, value: number) => void) => (
    ['X', 'Y', 'Z'].map((axis, index) => row({ label: `Pos ${axis}`, min: -1000, max: 1000, step: 0.1, decimals: 2 }, () => get()[index], (value) => setAt(index, value)))
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
    ['X', 'Y', 'Z'].map((axis, index) => row({ label: `Target ${axis}`, min: -1000, max: 1000, step: 0.1, decimals: 2 }, () => get()[index], (value) => {
        const next = [...get()] as [number, number, number];
        next[index] = value;
        set(next);
    }))
);

export const gridPosRows = (get: () => number[], set: (value: [number, number, number]) => void) => (
    vec3Rows('Pos', get, (index, value) => {
        const next = [...get()] as [number, number, number];
        next[index] = value;
        set(next);
    }, { min: -1000, max: 1000, step: 0.1, decimals: 2 })
);

export const gridRotRows = (get: () => number[], set: (value: [number, number, number]) => void) => (
    vec3Rows('Rot', get, (index, value) => {
        const next = [...get()] as [number, number, number];
        next[index] = value;
        set(next);
    }, { min: -Math.PI, max: Math.PI, step: 0.01, decimals: 2 })
);

export const checkbox = (
    key: string,
    label: string,
    value: boolean,
    onChange: (value: boolean) => void
): ReactNode => (
    <Container className="canvas-form-section d-flex column gap-05" key={key}>
        <FormField
            fieldKey={key}
            fieldType="checkbox"
            label={label}
            fieldValue={value}
            onFieldChange={(_, next) => onChange(Boolean(next))}
        />
    </Container>
);

export const checkboxWithDesc = (
    key: string,
    label: string,
    description: string,
    value: boolean,
    onChange: (value: boolean) => void
): ReactNode => (
    <Container className="canvas-form-section d-flex column gap-05" key={key}>
        <FormField
            fieldKey={key}
            fieldType="checkbox"
            label={label}
            fieldValue={value}
            onFieldChange={(_, next) => onChange(Boolean(next))}
        />
        <Container className="d-flex column gap-05">
            <span className="font-size-05 color-muted">{description}</span>
        </Container>
    </Container>
);

export const checkboxGrid = (items: Array<{ key: string; label: string; value: boolean; onChange: (value: boolean) => void }>): ReactNode => (
    <Container className="d-flex column gap-05">
        {items.map((item) => checkbox(item.key, item.label, item.value, item.onChange))}
    </Container>
);

export const sliderWithDesc = (
    key: string,
    description: string,
    value: number,
    onChange: (value: number) => void,
    options: Omit<RowDef, 'label'>
): ReactNode => (
    <Container className="canvas-form-section d-flex column gap-05" key={key}>
        <Container className="d-flex column gap-05">
            <Container className="canvas-form-row d-flex items-center content-between">
                <label className="canvas-form-label">{key}</label>
                <Container className="canvas-form-control d-flex items-center gap-02">
                    <Slider
                        min={options.min}
                        max={options.max}
                        step={options.step}
                        value={value}
                        onChange={onChange}
                    />
                    <span className="canvas-form-value">{typeof options.decimals === 'number' ? value.toFixed(options.decimals) : value}</span>
                </Container>
            </Container>
            <span className="font-size-05 color-muted">{description}</span>
        </Container>
    </Container>
);

export const warningBanner = (text: string): ReactNode => (
    <Container className="canvas-form-section d-flex column gap-05">
        <Container className="d-flex column gap-05">
            <Container className="canvas-render-warning font-size-05">{text}</Container>
        </Container>
    </Container>
);

export const colorField = (
    key: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    description?: string
): ReactNode => (
    <Container className="canvas-form-section d-flex column gap-05" key={key}>
        <FormField
            fieldKey={key}
            fieldType="color"
            label={label}
            fieldValue={value}
            onFieldChange={(_, next) => onChange(String(next))}
        />
        {description && (
            <Container className="d-flex column gap-05">
                <span className="font-size-05 color-muted">{description}</span>
            </Container>
        )}
    </Container>
);

export const colorExtras = (
    color: { key: string; label: string; value: string; onChange: (value: string) => void },
    toggles: Array<{ key: string; label: string; value: boolean; onChange: (value: boolean) => void }>
): ReactNode => (
    <Container className="d-flex column gap-05">
        {colorField(color.key, color.label, color.value, color.onChange)}
        {toggles.length > 0 && checkboxGrid(toggles)}
    </Container>
);

export const selectWithDesc = (
    key: string,
    description: string,
    value: string,
    onChange: (value: string) => void,
    placeholder: string,
    options: { title: string; value: string }[]
): ReactNode => (
    <Container className="d-flex column gap-025" key={key}>
        <Select
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            options={options}
        />
        <Container className="font-size-05 color-muted">{description}</Container>
    </Container>
);

export const checkboxWithDescList = (
    items: Array<{ key: string; label: string; description: string; value: boolean; onChange: (value: boolean) => void }>
): ReactNode => (
    <>{items.map((item) => checkboxWithDesc(item.key, item.label, item.description, item.value, item.onChange))}</>
);
