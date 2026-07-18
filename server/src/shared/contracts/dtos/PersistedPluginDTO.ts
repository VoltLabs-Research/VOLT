
export type PersistedPluginDTO<TPluginProps = unknown, TWorkflowProps = unknown> =
    Omit<TPluginProps, 'workflow'> & {
        _id: string;
        workflow: TWorkflowProps;
    };
