import type { IWorkflow, PluginStatus } from "@/types/plugin";

export interface IPluginRecord {
    _id: string;
    slug: string;
    workflow: IWorkflow;
    status: PluginStatus;
    validated: boolean;
    validationErrors: string[];
    createdAt: string;
    updatedAt: string;
};

export interface GetPluginsResponse {
    status: string;
    data: IPluginRecord[];
    page?: { current: number; total: number };
    results?: { skipped: number; total: number; paginated: number };
};

export interface GetPluginResponse {
    status: string;
    data: IPluginRecord;
};

export interface ValidateWorkflowResponse {
    status: string;
    data: {
        valid: boolean;
        errors: string;
    }
};

export interface ExecutePluginResponse {
    status: string;
    data: {
        analysisId: string
    };
};