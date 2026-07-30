import { Exporter, WorkflowExportType as ExportType } from '@volt/contracts/modules/plugin/enums';

export interface ExportEditorFormValues {
    exporter: string;
    type: string;
    options?: Record<string, unknown>;
}

export const EXPORT_EDITOR_DEFAULT_VALUES = {
    exporter: Exporter.ATOMISTIC,
    type: ExportType.GLB,
    options: {}
} satisfies ExportEditorFormValues;
