import { ModifierContext } from '@volt/contracts/modules/plugin/enums';

export interface ContextEditorFormValues {
    source: string;
}

export const CONTEXT_EDITOR_DEFAULT_VALUES = {
    source: ModifierContext.TRAJECTORY_DUMPS
} satisfies ContextEditorFormValues;
