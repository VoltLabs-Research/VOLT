import type { ReactNode } from 'react';

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
    extras?: ReactNode;
};

export interface Subsection {
    label: string;
    icon?: ReactNode;
    sections: SectionDef[];
    visible?: boolean;
}

export interface RenderGroup {
    id: string;
    title: string;
    icon: ReactNode;
    subsections: Subsection[];
}
