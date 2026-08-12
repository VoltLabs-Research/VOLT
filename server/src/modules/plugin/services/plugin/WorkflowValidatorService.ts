import type { Plugin } from '@modules/plugin/contracts/plugin';
import { PluginStatus } from '@volt/contracts/modules/plugin/enums';
import Workflow, { WorkflowProps } from '@modules/plugin/models/plugin/workflow/Workflow';
import {
    EntrypointNodeType,
    WorkflowNodeType,
    type WorkflowNode
} from '@modules/plugin/models/plugin/workflow/WorkflowTypes';
import { PluginDependencyResolverService } from '@modules/plugin/services/plugin/PluginDependencyResolverService';
import {
    readArgumentDefinitions,
    validateArgumentDefinitions,
    validateExposureExportConditions
} from '@modules/plugin/services/plugin/ArgumentDefinitionValidator';
import {
    buildWorkflowTopologyIndex,
    hasWorkflowCycle
} from '@modules/plugin/services/plugin/WorkflowTopologyIndex';
import {
    validateEntrypointTopology,
    validateIfStatementTopology,
    validatePluginNodeTopology,
    validateSwitchStatementTopology
} from '@modules/plugin/services/plugin/WorkflowTopologyRules';
import { validateRuntimeEdgeTopology } from '@modules/plugin/services/plugin/workflow-edge-rules';

export enum WorkflowValidationMode {
    Draft = 'draft',
    Strict = 'strict'
}

interface WorkflowValidationResult {
    isValid: boolean;
    errors?: string[];
    modifier?: WorkflowNode;
}

export class WorkflowValidatorService {
    constructor(
        private readonly pluginDependencyResolverService: PluginDependencyResolverService
    ) {}

    async validate(
        workflow: WorkflowProps,
        currentPluginId?: string,
        mode: WorkflowValidationMode = WorkflowValidationMode.Strict
    ): Promise<WorkflowValidationResult> {
        if (!Array.isArray(workflow?.nodes)) {
            return {
                isValid: false,
                errors: ['Workflow must have a nodes array']
            };
        }

        const errors: string[] = [];
        let modifier: WorkflowNode | undefined;
        const pluginNodes = workflow.nodes.filter((node) => node.type === WorkflowNodeType.Plugin);

        const modifierNode = workflow.nodes.find((node) => node.type === WorkflowNodeType.Modifier);
        if (!modifierNode) {
            errors.push('Workflow must have a modifier node');
        } else {
            modifier = modifierNode;
        }

        validateArgumentDefinitions(readArgumentDefinitions(workflow), errors);
        validateExposureExportConditions(workflow, errors);

        if (!Array.isArray(workflow.edges)) {
            errors.push('Workflow must have edges array');
        } else {
            const topology = buildWorkflowTopologyIndex(workflow);
            validateRuntimeEdgeTopology(workflow, errors, topology);
            validateIfStatementTopology(workflow, errors, topology);
            validateSwitchStatementTopology(workflow, errors, topology);
            validateEntrypointTopology(workflow, errors, topology);

            if (pluginNodes.length > 0) {
                validatePluginNodeTopology(workflow, errors, topology);
            }

            const nodeIds = new Set(workflow.nodes.map((node) => node.id));
            for (const edge of workflow.edges) {
                if (!nodeIds.has(edge.source)) {
                    errors.push(`Edge references unknown source node: ${edge.source}`);
                }
                if (!nodeIds.has(edge.target)) {
                    errors.push(`Edge references unknown target node: ${edge.target}`);
                }
            }

            if (workflow.nodes.length > 0 && workflow.edges.length > 0 && hasWorkflowCycle(workflow.nodes, workflow.edges)) {
                errors.push('Workflow contains a cycle');
            }
        }

        if (currentPluginId) {
            for (const node of pluginNodes) {
                if (node.data.pluginNode?.pluginId?.trim() === currentPluginId) {
                    errors.push(`Plugin node ${node.id} cannot reference the current plugin`);
                }
            }
        }

        if (!errors.length && mode === WorkflowValidationMode.Strict) {
            this.validateRuntimeReadiness(workflow, errors);
        }

        if (!errors.length && mode === WorkflowValidationMode.Strict) {
            errors.push(...await this.validatePublishedDependencies(workflow, currentPluginId));
        }

        return {
            isValid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            modifier
        };
    }

    private validateRuntimeReadiness(workflow: WorkflowProps, errors: string[]): void {
        const entrypointNode = workflow.nodes.find((node) => node.type === WorkflowNodeType.Entrypoint);
        if (!entrypointNode) {
            return;
        }

        const entrypoint = entrypointNode.data.entrypoint;
        if (!entrypoint) {
            errors.push(`Top-level entrypoint ${entrypointNode.id} is missing runtime configuration`);
            return;
        }

        if (!entrypoint.binaryObjectPath?.trim()) {
            errors.push(`Top-level entrypoint ${entrypointNode.id} requires an uploaded binary`);
        }

        if (!entrypoint.arguments?.trim()) {
            errors.push(`Top-level entrypoint ${entrypointNode.id} must define execution arguments`);
        }

        const needsEntrypointScript = entrypoint.type === EntrypointNodeType.PythonScript
            || entrypoint.type === EntrypointNodeType.PackagedExecutable;
        if (needsEntrypointScript && !entrypoint.entrypointScript?.trim()) {
            errors.push(`Top-level entrypoint ${entrypointNode.id} must define an entrypoint script`);
        }
    }

    private async validatePublishedDependencies(
        workflow: WorkflowProps,
        currentPluginId?: string
    ): Promise<string[]> {
        const rootPluginId = currentPluginId ?? '__draft_plugin__';
        const transientPlugin: Plugin = {
            _id: rootPluginId,
            id: rootPluginId,
            props: {
                team: '',
                workflow: new Workflow(rootPluginId, workflow),
                status: PluginStatus.DRAFT,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        };
        const dependencyValidation = await this.pluginDependencyResolverService.collectTransitivePublishedDependencies(transientPlugin);

        return dependencyValidation.errors;
    }
}
