import type { PersistedPluginDTO } from '@shared/contracts/dtos/PersistedPluginDTO';

export const mapPluginToPersistedDTO = <
    TWorkflowProps,
    TProps extends { workflow: { props: TWorkflowProps } }
>(plugin: { _id: string; props: TProps }): PersistedPluginDTO<TProps, TWorkflowProps> => {
    return {
        ...plugin.props,
        _id: plugin._id,
        workflow: plugin.props.workflow.props
    } as PersistedPluginDTO<TProps, TWorkflowProps>;
};
