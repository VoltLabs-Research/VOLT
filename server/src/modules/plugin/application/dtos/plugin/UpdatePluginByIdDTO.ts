import { PluginProps, PluginStatus } from '@modules/plugin/domain/entities/Plugin';
import { WorkflowProps } from '@modules/plugin/domain/entities/workflow/Workflow';

export interface UpdatePluginByIdInputDTO {
    pluginId: string;
    workflow?: WorkflowProps;
    status?: PluginStatus;
    /** @internal When true, binary fields (binaryObjectPath, binaryFileName, binary) 
     * in the workflow are saved as-is. When false (default), binary fields are 
     * preserved from the current DB state to prevent accidental overwrites. */
    _allowBinaryFieldUpdate?: boolean;
}

export interface UpdatePluginByIdOutputDTO extends PluginProps{}