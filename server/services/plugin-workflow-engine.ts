import logger from '@/logger';
import { Exporter, ModifierContext, NodeType } from '@/models/plugin';
import CLIExec from '@/services/cli-exec';
import DumpStorage from '@/services/dump-storage';
import { SYS_BUCKETS } from '@/config/minio';
import { IPlugin, IWorkflow, IWorkflowNode } from '@/types/models/modifier';
import { encodeMsgpack, readMsgpackFile } from '@/utilities/msgpack/msgpack';
import AtomisticExporter from '@/utilities/export/atoms'
import storage from '@/services/storage';
import DislocationExporter from '@/utilities/export/dislocations';
import MeshExporter from '@/utilities/export/mesh';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

interface ExecutionContext{
    outputs: Map<string, Record<string, any>>;
    userConfig: Record<string, any>;
    trajectoryId: string;
    analysisId: string;
    generatedFiles: string[];
    pluginSlug: string;
    pluginDir: string;
};

interface ExposureResult{
    exposureName: string;
    nodeId: string;
    nodeName: string;
    data: any;
    schema?: Record<string, any>;
    visualizers?: {
        canvas: boolean;
        raster: boolean;
        listing: Record<string, string>;
    };
    export?: {
        exporter: Exporter;
        type: string;
        objectPath?: string;
    };
};

export default class PluginWorkflowEngine{
    private cli: CLIExec;
    private pluginsDir: string;

    constructor(pluginsDir: string = process.env.PLUGINS_DIR || 'plugins'){
        this.cli = new CLIExec();
        this.pluginsDir = pluginsDir;
    }

    async execute(
        plugin: IPlugin,
        trajectoryId: string,
        analysisId: string,
        userConfig: Record<string, any>
    ): Promise<ExposureResult[]>{
        const context: ExecutionContext = {
            outputs: new Map(),
            userConfig,
            trajectoryId,
            analysisId,
            generatedFiles: [],
            pluginSlug: plugin.slug,
            pluginDir: path.join(this.pluginsDir, plugin.slug)
        };

        try{
            const executionOrder = this.topologicalSort(plugin.workflow);
            logger.info(`[PluginWorkflowEngine] Executing "${plugin.slug}" - ${executionOrder.length} nodes`);

            for(const node of executionOrder){
                await this.executeNode(node, plugin.workflow, context);
            }

            return this.collectExposureResults(plugin.workflow, context);
        }catch(error: any){
            logger.error(`[WorkflowEngine] Execution failed:  ${error.message}`);
            await this.cleanup(context. generatedFiles);
            throw error
        }
    }

    private topologicalSort(workflow: IWorkflow): IWorkflowNode[]{
        const nodeMap = new Map(workflow.nodes.map((node) => [node.id, node]));
        const inDegree = new Map<string, number>();
        const adjacency = new Map<string, string[]>();
        
        for(const node of workflow.nodes){
            inDegree.set(node.id, 0);
            adjacency.set(node.id, []);
        }

        for(const edge of workflow.edges){
            adjacency.get(edge.source)?.push(edge.target);
            inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
        }

        const queue: string[] = [];
        const result: IWorkflowNode[] = [];

        for(const [nodeId, degree] of inDegree){
            if(degree === 0) queue.push(nodeId);
        }

        while(queue.length > 0){
            const nodeId = queue.shift()!;
            const node = nodeMap.get(nodeId);
            if(node) result.push(node);
            for(const neighbor of adjacency.get(nodeId) || []){
                const newDegree = (inDegree.get(neighbor) || 1) - 1;
                inDegree.set(neighbor, newDegree);
                if(newDegree === 0) queue.push(neighbor);
            }
        }
        
        return result;
    }

    private async executeNode(
        node: IWorkflowNode,
        workflow: IWorkflow,
        context: ExecutionContext
    ): Promise<void>{
        logger.debug(`[PluginWorkflowEngine] Executing:  ${node.name} (${node.type})`);
        let outputs: Record<string, any> = {};

        switch(node.type){
            case NodeType.MODIFIER:
                outputs = this.executeModifier(node);
                break;
            case NodeType.ARGUMENTS:
                outputs = this.executeArguments(node, context);
                break;
            case NodeType.CONTEXT:
                outputs = this.executeContext(node, context);
                break;
            case NodeType.FOREACH:
                outputs = this.executeForEach(node, context);
                break;
            case NodeType.ENTRYPOINT:
                outputs = await this.executeEntrypoint(node, workflow, context);
                break;
            case NodeType.EXPOSURE:
                outputs = await this.executeExposure(node, context);
                break;
            case NodeType.SCHEMA:
                outputs = this.executeSchema(node);
                break;
            case NodeType.VISUALIZERS:
                outputs = this.executeVisualizers(node);
                break;
            case NodeType.EXPORT:
                outputs = await this.executeExport(node, workflow, context);
                break;
        }
        context.outputs.set(node.name, outputs);
    }

    private executeModifier(node: IWorkflowNode): Record<string, any>{
        const data = node.data.modifier!;
        return data;
    };

    private executeArguments(node: IWorkflowNode, context: ExecutionContext): Record<string, any>{
        const argDefs = node.data.arguments?.arguments || [];
        const argsArray: string[] = [];
        const values: Record<string, any> = {};

        for(const argDef of argDefs){
            // priority: preset (value) > user config > default
            const value = argDef.value ?? context.userConfig[argDef.argument] ?? argDef.default;
            values[argDef.argument] = value;
            if(value === undefined || value === null) continue;
            if(argDef.type === 'boolean'){
                if(value === true || value === 'true'){
                    argsArray.push(`--${argDef.argument}`);
                }
            }else{
                argsArray.push(`--${argDef.argument}`, String(value));
            }
        }

        return {
            as_str: argsArray.join(' '),
            as_array: argsArray,
            ... values
        };
    }

    private async executeContext(node: IWorkflowNode, context: ExecutionContext): Promise<Record<string, any>>{
        const source = node.data.context?.source;
        if(source === ModifierContext.TRAJECTORY_DUMPS){
            const dumps = await DumpStorage.listDumps(context.trajectoryId);
            return {
                trajectory_dumps: dumps,
                count: dumps.length
            };
        }
        throw new Error(`Unknown context source: ${source}`);
    }

    private executeForEach(node: IWorkflowNode, context: ExecutionContext): Record<string, any>{
        const ref = node.data.forEach?.iterableSource;
        if(!ref) throw new Error('PluginWorkflowEngine::ForEach::IterableSource::Required');
        const items = this.resolveReference(ref, context);
        if(!Array.isArray(items)){
            throw new Error('PluginsWorkflowEngine::ForEach::IterableSource::NotAnArray');
        }
        return {
            items,
            count: items.length,
            currentValue: null,
            currentIndex: -1,
            outputPath: null
        };
    }

    private async executeEntrypoint(
        node: IWorkflowNode,
        workflow: IWorkflow, 
        context: ExecutionContext
    ): Promise<Record<string, any>>{
        const config = node.data.entrypoint!;
        const binaryPath = path.join(context.pluginDir, config.binary);

        const forEachNode = this.findParentByType(node.id, workflow, NodeType.FOREACH);
        if(!forEachNode) throw new Error('Entrypoint must be connected to ForEach');

        const forEachOutput = context.outputs.get(forEachNode.name)!;
        const items = forEachOutput.items as string[];
        const results: any[] = [];

        for(let i = 0; i < items.length; i++){
            const item = items[i];
            forEachOutput.currentValue = item;
            forEachOutput.currentIndex = i;
            forEachOutput.outputPath = path.join(
                os.tmpdir(),
                `${context.pluginSlug}-${context.analysisId}-${i}-${Date.now()}`
            );

            const resolvedArgs = this.resolveTemplate(config.arguments, context);
            const argsArray = this.parseArgumentString(resolvedArgs);
            logger.info(`[PluginWorkflowEngine] Running:  ${config.binary} [${i + 1}/${items.length}]`);

            try{
                await this.cli.run(binaryPath, argsArray,/* { timeout: config.timeout }*/);
                results.push({ index: i, input: item, success: true, outputPath: forEachOutput.outputPath });
            }catch(error: any){
                logger.error(`[PluginWorkflowEngine] Binary failed for item ${i}: ${error.message}`);
                results.push({ index: i, input: item, success:  false, error: error.message });
            }
        }
        return {
            results,
            successCount: results.filter((result) => result.success).length,
            failCount: results.filter((result) => !result.success).length
        };
    }

    private async executeExposure(node: IWorkflowNode, context: ExecutionContext): Promise<Record<string, any>>{
        const config = node.data.exposure!;
        const forEachOutput = context.outputs.get('forEach');
        if(!forEachOutput?.outputPath){
            throw new Error('Exposure: No output path from forEach');
        }
        const resultsPath = `${forEachOutput.outputPath}_${config.results}`;

        try{
            const rawData = await readMsgpackFile(resultsPath);
            context.generatedFiles.push(resultsPath);
            
            let data = rawData;
            if(config.iterable){
                data = this.getNestedValue(rawData, config.iterable);
            }

            const storageKey = [
                'plugins',
                `trajectory-${context.trajectoryId}`,
                `analysis-${context. analysisId}`,
                node.name,
                `timestep-${forEachOutput.currentIndex}. msgpack`
            ].join('/');

            const buffer = encodeMsgpack(data);
            await storage.put(SYS_BUCKETS.PLUGINS, storageKey, buffer, {
                'Content-Type': 'application/msgpack'
            });

            return {
                name: config.name,
                raw: rawData,
                data,
                count: Array.isArray(data) ? data.length : 1,
                storageKey
            };
        }catch(error: any){
            logger.error(`[WorkflowEngine] Failed to read exposure:  ${error.message}`);
            return {
                name:  config.name,
                error: error.message,
                data: null
            };
        }
    }

    private executeSchema(node: IWorkflowNode): Record<string, any>{
        return {
            definition: node.data.schema?.definition || {}
        };
    }

    private executeVisualizers(node: IWorkflowNode): Record<string, any>{
        const config = node.data.visualizers!;
        return {
            canvas: config.canvas ?? false,
            raster: config.raster ?? false,
            listing: config.listing ?? {}
        };
    }

    private async executeExport(
        node: IWorkflowNode,
        workflow: IWorkflow,
        context: ExecutionContext
    ): Promise<Record<string, any>>{
        const config = node.data.export!;
        const exposureNode = this.findAncestorByType(node.id, workflow, NodeType.EXPOSURE);
        if(!exposureNode){
            throw new Error('Export must be connected to an Exposure');
        }
        const exposureOutput = context.outputs.get(exposureNode.name);
        if(!exposureOutput?.data){
            return { error: 'No data to export' };
        }

        const forEachOutput = context.outputs.get('forEach');
        const timestep = forEachOutput?.currentIndex ?? 0;

        const objectName = [
            `trajectory-${context. trajectoryId}`,
            `analysis-${context.analysisId}`,
            'glb',
            `${timestep}`,
            `${exposureNode.name}. ${config.type}`
        ].join('/');
        
        try{
            const exporter = this.getExporter(config.exporter);
            await exporter.toGLBMinIO(exposureOutput.data, objectName, config.options);
            return {
                success: true,
                objectPath: objectName,
                exporter: config.exporter,
                type: config.type
            };
        }catch(error: any){
            logger.error(`[PluginWorkflowEngine] Export failed:  ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    private resolveReference(ref: string, context: ExecutionContext): any{
        const parts = ref.split('.');
        const nodeName = parts[0];
        const propertyPath = parts.slice(1).join('.');
        const nodeOutput = context.outputs.get(nodeName);
        if(!nodeOutput) return undefined;
        if(!propertyPath) return nodeOutput;
        return this.getNestedValue(nodeOutput, propertyPath);
    }

    private resolveTemplate(template: string, context: ExecutionContext): string{
        return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, ref) => {
            const value = this.resolveReference(ref.trim(), context);
            return value !== undefined ? String(value) : '';
        });
    }

    private getNestedValue(obj: any, path: string): any{
        return path.split('.').reduce((acc, key) => acc?.[key], obj);  
    }

    private parseArgumentString(str: string): string[]{
        const args: string[] = [];
        let current = '';
        let inQuote= false;
        let quoteChar = '';
        for(const char of str){
            if((char === '"' || char === "'") && !inQuote){
                inQuote = true;
                quoteChar = char;
            }else if(char === quoteChar && inQuote){
                inQuote = false;
                quoteChar = '';
            }else if(char === ' ' && !inQuote){
                if(current){
                    args.push(current);
                    current = '';
                }
            }else{
                current += char;
            }
        }

        if(current) args.push(current);
        return args.filter(Boolean);
    }

    private findParentByType(nodeId: string, workflow: IWorkflow, type: NodeType): IWorkflowNode | null{
        const parentEdge = workflow.edges.find((edge) => edge.target === nodeId);
        if(!parentEdge) return null;

        const parentNode = workflow.nodes.find((node) => node.id === parentEdge.source);
        if(parentNode?.type === type) return parentNode;

        return this.findParentByType(parentEdge.source, workflow, type);
    }

    private findAncestorByType(nodeId: string, workflow: IWorkflow, type: NodeType): IWorkflowNode | null{
        const visited = new Set<string>();
        const queue = [nodeId];
        while(queue.length > 0){
            const currentId = queue.shift()!;
            if(visited.has(currentId)) continue;
            visited.add(currentId);

            const parentEdges = workflow.edges.filter((edge) => edge.target === currentId);
            for(const edge of parentEdges){
                const parentNode = workflow.nodes.find((node) => node.id === edge.source);
                if(parentNode?.type === type) return parentNode;
                queue.push(edge.source);
            }
        }

        return null;
    }

    private getExporter(exporterType: Exporter){
        switch(exporterType){
            case Exporter.ATOMISTIC:
                return new AtomisticExporter();
            case Exporter.DISLOCATION:
                return new DislocationExporter();
            case Exporter.MESH:
            default:
                return new MeshExporter();
        }
    }

    private collectExposureResults(workflow: IWorkflow, context: ExecutionContext): ExposureResult[]{
        const exposureNodes = workflow.nodes.filter((node) => node.type === NodeType.EXPOSURE);
        const results: ExposureResult[] = [];

        for(const exposureNode of exposureNodes){
            const exposureOutput = context.outputs.get(exposureNode.name);
            if(!exposureOutput) continue;

            const schemaNode = this.findChildByType(exposureNode.id, workflow, NodeType. SCHEMA);
            const visualizersNode = this. findDescendantByType(exposureNode.id, workflow, NodeType.VISUALIZERS);
            const exportNode = this.findDescendantByType(exposureNode.id, workflow, NodeType.EXPORT);

            results.push({
                exposureName: exposureOutput.name,
                nodeId: exposureNode.id,
                nodeName: exposureNode.name,
                data: exposureOutput.data,
                schema: schemaNode ? context.outputs.get(schemaNode.name)?.definition : undefined,
                // @ts-ignore
                visualizers: visualizersNode ? context. outputs.get(visualizersNode.name) : undefined,
                // @ts-ignore
                export: exportNode ?  context.outputs.get(exportNode.name) : undefined
            });
        }
        return results
    }

    private findChildByType(nodeId: string, workflow: IWorkflow, type: NodeType): IWorkflowNode | null{
        const childEdge = workflow.edges.find((edge) => edge.source === nodeId);
        if(!childEdge) return null;
        const childNode = workflow.nodes.find((node) => node.id === childEdge.target);
        return childNode?.type === type ? childNode : null;
    }

    private findDescendantByType(nodeId: string, workflow: IWorkflow, type: NodeType): IWorkflowNode | null{
        const visited = new Set<string>();
        const queue = [nodeId];
        while(queue.length > 0){
            const currentId = queue.shift()!;
            if(visited.has(currentId)) continue;
            visited.add(currentId);
            const childEdges = workflow.edges.filter((edge) => edge.source === currentId);
            for(const edge of childEdges){  
                const childNode = workflow.nodes.find((node) => node.id === edge.target);
                if(childNode?.type === type) return childNode;
                queue.push(edge.target);
            }
        }

        return null;
    }

    private async cleanup(files: string[]): Promise<void>{
        for(const file of files){
            try{
                await fs.unlink(file);
            }catch{
                // cleanup errors can be ignored
            }
        }
    }
};