import { z } from 'zod';
import { Exporter, ExportType_ as ExportType } from '@/modules/plugin/api/entities/plugin/workflow-enums';

export const exportEditorSchema = z.object({
    exporter: z.string().default(Exporter.ATOMISTIC),
    type: z.string().default(ExportType.GLB),
    options: z.record(z.string(), z.unknown()).optional()
}).strict();

export type ExportEditorFormValues = z.infer<typeof exportEditorSchema>;

export const EXPORT_EDITOR_DEFAULT_VALUES = {
    exporter: Exporter.ATOMISTIC,
    type: ExportType.GLB,
    options: {}
} satisfies ExportEditorFormValues;
