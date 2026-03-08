import Workflow from './workflow/Workflow';

import type { PluginProjection } from '@modules/plugin/domain/services/plugin/WorkflowProjectionService';

export enum PluginStatus {
    Draft = 'draft',
    Published = 'published',
    Disabled = 'disabled'
};

export interface PluginProps extends Partial<PluginProjection> {
    team: string;
    workflow: Workflow,
    status: PluginStatus;
    validated: boolean;
    validationErrors: string[];
    createdAt: Date;
    updatedAt: Date;
    binaryPath?: string | null;
};

export default class Plugin {
    constructor(
        public _id: string,
        public props: PluginProps
    ){}

    get id(): string {
        return this._id;
    }
};
