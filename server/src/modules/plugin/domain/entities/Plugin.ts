import Workflow from './workflow/Workflow';
import type { PluginProjection } from '../services/WorkflowProjectionService';

export enum PluginStatus {
    Draft = 'draft',
    Published = 'published',
    Disabled = 'disabled'
};

export interface PluginProps extends Partial<PluginProjection> {
    team: string;
    slug: string;
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
        public id: string,
        public props: PluginProps
    ){}
};