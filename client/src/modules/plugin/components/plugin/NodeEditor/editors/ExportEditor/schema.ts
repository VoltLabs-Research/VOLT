import { Exporter, ExportType_ as ExportType } from '@/modules/plugin/api/entities/plugin/workflow-enums';

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
