export enum WorkflowNodeType{
    Modifier = 'modifier',
    Arguments = 'arguments',
    Context = 'context',
    ForEach = 'foreach',
    Entrypoint = 'entrypoint',
    Exposure = 'exposure',
    Schema = 'schema',
    Visualizers = 'visualizers',
    Export = 'export',
    IfStatment = 'if-statement'
};

export interface WorkflowProps{
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    viewport?: WorkflowViewport;
};

export interface WorkflowViewport{
    x: number;
    y: number;
    zoom: number;
};

export interface WorkflowEdge{
    id: string;
    source: string;
    sourceHandle?: string;
    target: string;
    targetHandle?: string;
};

export interface WorkflowNode{
    id: string;
    type: WorkflowNodeType;
    position: {
        x: number;
        y: number;
    };
    data: WorkflowNodeData;
};

export interface ModifierNodeData{
    name: string;
    icon?: string;
    author?: string;
    license?: string;
    version?: string;
    homepage?: string;
    description?: string;
};

export enum ArgumentType{
    Select = 'select',
    Number = 'number',
    Frame = 'frame',
    Boolean = 'boolean',
    String = 'string'
};

export interface ArgumentOption{
    key: string;
    label: string;
};

export interface ArgumentDefinition{
    argument: string;
    type: ArgumentType;
    label: string;
    default?: any;
    value?: any;
    options?: ArgumentOption[];
    min?: number;
    max?: number;
    step?: number;
};

export interface ArgumentsNodeData{
    arguments: ArgumentDefinition[];
};

export enum ContextSource{
    TrajectoryDumps = 'trajectory-dumps'
};

export interface ContextNodeData{
    source: ContextSource;
};

export interface ForEachNodeData{
    iterableSource: string;
};

export interface ExposureNodeData{
    name: string;
    results: string;
    iterable?: string;
};

export interface SchemaNodeData{
    definition: Record<string, any>;
};

export interface EntrypointNodeData{
    binary: string;
    binaryObjectPath?: string;
    binaryFileName?: string;
    binaryHash?: string;
    arguments: string;
};

export interface VisualizerNodeData{
    canvas?: boolean;
    raster?: boolean;
    listingTitle?: string;
    listing?: Record<string, string>;
    perAtomProperties?: string[];
};

export enum Exporter{
    Atomistic = 'AtomisticExporter',
    Mesh = 'MeshExporter',
    Dislocation = 'DislocationExporter',
    Chart = 'ChartExporter'
};

export enum ExportType{
    GLB = 'glb',
    ChartPNG = 'chart-png'
};

export interface ExportNodeData{
    exporter: Exporter;
    type: ExportType;
    options?: Record<string, any>;
};

export enum IfStatementConditionType{
    And = 'and',
    Or = 'or'
};

export enum IfStatementConditionHandler{
    IsEqualTo = 'is-equal-to',
    IsNotEqualTo = 'is-not-equal-to'
};

export interface IfStatementCondition{
    type: IfStatementConditionType;
    leftExpression: string;
    handler: IfStatementConditionHandler;
    rightExpression: string;
};

export interface IfStatementNodeData{
    conditions: IfStatementCondition[];
};

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

export default class Workflow{
    constructor(
        public id: string,
        public props: WorkflowProps
    ){}

    /**
     * Find immediate parent node of specified type.
     */
    findParentByType(nodeId: string, type: WorkflowNodeType): WorkflowNode | null{
        const parentEdge = this.props.edges.find((edge) => edge.target === nodeId);
        if(!parentEdge) return null;

        const parentNode = this.props.nodes.find((node) => node.id === parentEdge.source);
        if(parentNode?.type === type) return parentNode;

        return this.findParentByType(parentEdge.source, type);
    }

    /**
     * Find any ancestor node of specified type (BFS).
     */
    findAncestorByType(nodeId: string, type: WorkflowNodeType): WorkflowNode | null{
        const visited = new Set<string>();
        const queue = [nodeId];

        while(queue.length > 0){
            const currentId = queue.shift()!;
            if(visited.has(currentId)) continue;
            visited.add(currentId);

            const parentEdges = this.props.edges.filter((edge) => edge.target === currentId);
            for(const edge of parentEdges){
                const parentNode = this.props.nodes.find((node) => node.id === edge.source);
                if(parentNode?.type === type) return parentNode;
                queue.push(edge.source);
            }
        }

        return null;
    }

    /**
     * Find descendant node of specified type (BFS)
     */
    findDescendantByType(nodeId: string, type: WorkflowNodeType): WorkflowNode | null{
        const visited = new Set<string>();
        const queue = [nodeId];

        while(queue.length > 0){
            const currentId = queue.shift()!;
            if(visited.has(currentId)) continue;
            visited.add(currentId);

            const childEdges = this.props.edges.filter((edge) => edge.source === currentId);
            for(const edge of childEdges){
                const childNode = this.props.nodes.find((node) => node.id === edge.target);
                if(childNode?.type === type) return childNode;
                if(childNode) queue.push(edge.target);
            }
        }

        return null;
    }

    topologicalSort(): WorkflowNode[]{
        const nodeMap = new Map(this.props.nodes.map((node) => [node.id, node]));
        const inDegree = new Map<string, number>();
        const adjacency = new Map<string, string[]>();

        for(const node of this.props.nodes){
            inDegree.set(node.id, 0);
            adjacency.set(node.id, []);
        }

        for(const edge of this.props.edges){
            const adj = adjacency.get(edge.source) || [];
            adj.push(edge.target);
            adjacency.set(edge.source, adj);
            inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
        }

        const queue: string[] = [];
        for(const [id, degree] of inDegree){
            if(degree === 0) queue.push(id);
        }

        const result: WorkflowNode[] = [];
        while(queue.length > 0){
            const nodeId = queue.shift()!;
            const node = nodeMap.get(nodeId);
            if(node) result.push(node);

            for(const neighbor of adjacency.get(nodeId) || []){
                const newDegree = (inDegree.get(neighbor) || 0) - 1;
                inDegree.set(neighbor, newDegree);
                if(newDegree === 0) queue.push(neighbor);
            }
        }
        
        return result;
    }
};