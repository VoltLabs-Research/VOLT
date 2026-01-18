import Workflow from './workflow/Workflow';

export enum PluginStatus {
    Draft = 'draft',
    Published = 'published',
    Disabled = 'disabled'
};

export interface PluginProps {
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