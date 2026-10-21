import type { Plugin } from '@modules/plugin/contracts/plugin';
import { readWorkflowModifierKey } from '@volt/contracts/modules/plugin/arguments';

export const getPluginModifierKey = (plugin: Plugin): string => (
    plugin.props.modifier?.key?.trim() ?? readWorkflowModifierKey(plugin.props.workflow.props)
);
