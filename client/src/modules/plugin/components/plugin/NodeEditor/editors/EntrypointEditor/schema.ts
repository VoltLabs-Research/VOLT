import { EntrypointType } from '@/modules/plugin/api/entities/plugin/workflow-enums';

export interface EntrypointEditorFormValues {
    binary: string;
    binaryObjectPath?: string;
    binaryFileName?: string;
    binaryHash?: string;
    type: EntrypointType;
    arguments: string;
    requirementsFile: string;
    entrypointScript: string;
}

export const ENTRYPOINT_EDITOR_DEFAULT_VALUES = {
    binary: '',
    type: EntrypointType.EXECUTABLE,
    arguments: '',
    requirementsFile: '',
    entrypointScript: ''
} satisfies EntrypointEditorFormValues;
