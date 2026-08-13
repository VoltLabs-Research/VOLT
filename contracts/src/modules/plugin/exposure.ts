import type { IArgumentDefinition, IArgumentVisibilityCondition } from './workflow';

export interface IComputedArgumentOption{
    key: string;
    label: string;
}

export interface IExposureProperty{
    key: string;
    label?: string;
    type?: string;
}

export interface IExposureExport{
    exporter: string;
    type: string;
    options?: Record<string, unknown>;
}

/** How a value is written in a results-panel cell. Raw when omitted. */
export type PanelColumnFormat = 'integer' | 'decimal' | 'percent';

export interface IPanelColumn{
    /** Key in the sub-listing row. */
    column: string;
    label: string;
    format?: PanelColumnFormat;
}

/**
 * Declares one compact results table for the analysis panel, in the spirit of the
 * tables OVITO shows next to a modifier ("Structure analysis results").
 *
 * The plugin owns everything semantic here: which sub-listing to read, which column is
 * the row label, and the colour of each category. VOLT resolves nothing by name -- a
 * category the plugin does not declare a colour for simply gets a generated one, so a
 * plugin can add a category without any change on this side.
 */
export interface IPanelTable{
    /** Name of the sub-listing this table reads, as emitted in the payload. */
    source: string;
    title: string;
    /** Row label column. */
    label: string;
    columns: IPanelColumn[];
    /**
     * Column whose value keys into `colors`, painting the swatch that ties a row to the
     * geometry it counts. Omit for a table with no colour dimension.
     */
    colorBy?: string;
    /** Category -> RGBA (0-1), declared by the plugin. */
    colors?: Record<string, [number, number, number, number]>;
}

export interface IExposurePanel{
    tables: IPanelTable[];
}

export interface IExposureComputed{
    _id: string;
    id?: string;
    name: string;
    icon?: string;
    results: string;
    hasListing?: boolean;
    properties?: IExposureProperty[];
    export: IExposureExport | null;
    /** Carried through from the workflow node so the run can gate this exposure. */
    exportWhen?: IArgumentVisibilityCondition;
    /** Present when the plugin wants this exposure summarised in the analysis panel. */
    panel?: IExposurePanel;
}

export interface IComputedArgumentDefinition extends Omit<IArgumentDefinition, 'options' | 'listArguments'>{
    options?: IComputedArgumentOption[];
    listArguments?: IComputedArgumentDefinition[];
}

export interface IListingExposure{
    exposureId: string;
    name: string;
}

export interface IListingsWithExposures{
    pluginName: string;
    pluginId: string;
    exposures: IListingExposure[];
}
