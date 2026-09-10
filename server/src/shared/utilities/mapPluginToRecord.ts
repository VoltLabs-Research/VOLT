import type { PluginRecord } from '@shared/contracts/operations/PluginRecord';

export const mapPluginToRecord = <
    TWorkflowProps,
    TProps extends { workflow: { props: TWorkflowProps } }
>(plugin: { _id: string; props: TProps }): PluginRecord<TProps, TWorkflowProps> => {
    return {
        ...plugin.props,
        _id: plugin._id,
        workflow: plugin.props.workflow.props
    } as PluginRecord<TProps, TWorkflowProps>;
};
