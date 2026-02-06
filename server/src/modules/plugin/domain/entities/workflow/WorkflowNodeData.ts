import { ModifierNodeData } from './nodes/ModifierNode';
import { ArgumentsNodeData } from './nodes/ArgumentNode';
import { ContextNodeData } from './nodes/ContextNode';
import { ForEachNodeData } from './nodes/ForEachNode';
import { EntrypointNodeData } from './nodes/EntrypointNode';
import { ExposureNodeData } from './nodes/ExposureNode';
import { SchemaNodeData } from './nodes/SchemaNode';
import { VisualizerNodeData } from './nodes/VisualizerNode';
import { ExportNodeData } from './nodes/ExportNode';
import { IfStatementNodeData } from './nodes/IfStatementNode';

export interface WorkflowNodeData{
    modifier?: ModifierNodeData;
    arguments?: ArgumentsNodeData;
    context?: ContextNodeData;
    forEach?: ForEachNodeData;
    entrypoint?: EntrypointNodeData;
    exposure?: ExposureNodeData;
    schema?: SchemaNodeData;
    visualizers?: VisualizerNodeData;
    export?: ExportNodeData;
    ifStatement?: IfStatementNodeData;
};