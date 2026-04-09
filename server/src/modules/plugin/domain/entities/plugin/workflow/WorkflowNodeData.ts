import { ModifierNodeData } from './nodes/ModifierNode';
import { ArgumentsNodeData } from './nodes/ArgumentNode';
import { ContextNodeData } from './nodes/ContextNode';
import { ForEachNodeData } from './nodes/ForEachNode';
import { EntrypointNodeData } from './nodes/EntrypointNode';
import { PluginNodeData } from './nodes/PluginNode';
import { ExposureNodeData } from './nodes/ExposureNode';
import { ExportNodeData } from './nodes/ExportNode';
import { IfStatementNodeData } from './nodes/IfStatementNode';
import { SwitchCaseNodeData, SwitchStatementNodeData } from './nodes/SwitchStatementNode';

export interface WorkflowNodeData{
    modifier?: ModifierNodeData;
    arguments?: ArgumentsNodeData;
    context?: ContextNodeData;
    forEach?: ForEachNodeData;
    entrypoint?: EntrypointNodeData;
    pluginNode?: PluginNodeData;
    exposure?: ExposureNodeData;
    export?: ExportNodeData;
    ifStatement?: IfStatementNodeData;
    switchStatement?: SwitchStatementNodeData;
    switchCase?: SwitchCaseNodeData;
};
