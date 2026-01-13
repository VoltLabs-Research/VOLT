import Workflow from "./workflow";

export enum PluginStatus{
    Draft = 'draft',
    Published = 'published',
    Disabled = 'disabled'
};

export interface PluginProps{
    slug: string;
    workflow: Workflow,
    status: PluginStatus;
    validated: boolean;
    validationErrors: string[];
    createdAt: Date;
    updatedAt: Date;
};

export default class Plugin{
    constructor(
        public id: string,
        public props: PluginProps
    ){}
};