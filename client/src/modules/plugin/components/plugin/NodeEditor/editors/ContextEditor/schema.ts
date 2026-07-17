import { ModifierContext } from '@/modules/plugin/api/types/plugin/workflow-enums';

export interface ContextEditorFormValues {
    source: string;
}

export const CONTEXT_EDITOR_DEFAULT_VALUES = {
    source: ModifierContext.TRAJECTORY_DUMPS
} satisfies ContextEditorFormValues;
