import { ModifierContext } from '@/modules/plugin/api/entities/plugin/workflow-enums';

export interface ContextEditorFormValues {
    source: string;
}

export const CONTEXT_EDITOR_DEFAULT_VALUES = {
    source: ModifierContext.TRAJECTORY_DUMPS
} satisfies ContextEditorFormValues;
