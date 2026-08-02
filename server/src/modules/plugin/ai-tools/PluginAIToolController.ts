import typia from 'typia';
import AIToolController from '@shared/ai/AIToolController';
import { AIToolProvider } from '@shared/ai/provider-registry';
import { AITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import PluginService from '@modules/plugin/services/PluginService';
import AnalysisResultSummarizer from '@modules/plugin/services/AnalysisResultSummarizer';
import PluginArgumentDescriber from '@modules/plugin/services/plugin/PluginArgumentDescriber';
import { PluginStatus } from '@volt/contracts/modules/plugin/enums';
import type { PluginRecord } from '@modules/plugin/contracts/plugin';
import type { WorkflowProps } from '@modules/plugin/models/plugin/workflow/Workflow';
import { ExportType } from '@shared/domain/port/persistence';
import type {
    ComparePluginsInput,
    ExecutePipelineInput,
    ExportAnalysisResultInput,
    GetSubListingInput,
    InstallPluginInput,
    ListAnalysisResultOptionsInput,
    ListPluginListingDocumentsInput,
    ListPluginsInput,
    PluginRefInput,
    ReadAnalysisResultRowsInput,
    SearchRegistryPluginsInput,
    SummarizeAnalysisResultInput,
    UninstallPluginInput,
    ValidateWorkflowInput
} from '@volt/contracts/modules/plugin/ai-tools';

interface PluginTopology {
    name: string;
    status: string;
    argumentKeys: string[];
    exposureNames: string[];
    nodeCount: number;
    edgeCount: number;
    nodeTypeCounts: Record<string, number>;
}

const summarize = (plugin: PluginRecord): PluginTopology => {
    const { nodes, edges } = plugin.workflow;
    const nodeTypeCounts: Record<string, number> = {};
    for (const node of nodes) {
        nodeTypeCounts[node.type] = (nodeTypeCounts[node.type] ?? 0) + 1;
    }
    return {
        name: plugin.modifier?.name ?? plugin._id,
        status: plugin.status,
        argumentKeys: (plugin.arguments ?? []).map((arg) => arg.argument).filter(Boolean),
        exposureNames: (plugin.exposures ?? []).map((exposure) => exposure.name).filter(Boolean),
        nodeCount: nodes.length,
        edgeCount: edges.length,
        nodeTypeCounts
    };
};

const diffSets = (a: string[], b: string[]) => ({
    onlyInA: a.filter((item) => !b.includes(item)),
    onlyInB: b.filter((item) => !a.includes(item)),
    shared: a.filter((item) => b.includes(item))
});

@AIToolProvider()
export default class PluginAIToolController extends AIToolController {
    #service = new PluginService();
    #summarizer = new AnalysisResultSummarizer();
    #argumentDescriber = new PluginArgumentDescriber();

    @AITool({
        name: 'install_plugin',
        description: 'Install a plugin from the registry into the team.',
        parameters: typia.llm.parameters<InstallPluginInput>(),
        validate: typia.createValidate<InstallPluginInput>()
    })
    async installPlugin(input: InstallPluginInput & AIToolScope) {
        return this.#service.installRegistry(input);
    }

    @AITool({
        name: 'clone_plugin',
        description: 'Clone an existing plugin into a new draft.',
        parameters: typia.llm.parameters<PluginRefInput>(),
        validate: typia.createValidate<PluginRefInput>()
    })
    async clonePlugin(input: PluginRefInput & AIToolScope) {
        return this.#service.clonePlugin(input);
    }

    @AITool({
        name: 'search_registry_plugins',
        description: 'Search the public registry for installable plugins.',
        parameters: typia.llm.parameters<SearchRegistryPluginsInput>(),
        validate: typia.createValidate<SearchRegistryPluginsInput>()
    })
    async searchRegistryPlugins(input: SearchRegistryPluginsInput & AIToolScope) {
        const { total, items } = await this.#service.searchRegistry(input);
        return {
            summary: `Found ${total} registry plugins.`,
            data: items
        };
    }

    @AITool({
        name: 'list_plugins',
        description: 'List analysis plugins installed in the team.',
        parameters: typia.llm.parameters<ListPluginsInput>(),
        validate: typia.createValidate<ListPluginsInput>()
    })
    async listPlugins(input: ListPluginsInput & AIToolScope) {
        // typia validates but does not transform, so the documented defaults are
        // applied here; an absent key does not override them on spread. The service
        // falls back to limit 100, so the schema's 50 has to be spelled out.
        const { total, data } = await this.#service.listPlugins({
            page: 1,
            limit: 50,
            ...input
        });
        return {
            summary: `Found ${total} plugins.`,
            data
        };
    }

    @AITool({
        name: 'get_plugin',
        description: 'Get detailed metadata about a specific plugin.',
        parameters: typia.llm.parameters<PluginRefInput>(),
        validate: typia.createValidate<PluginRefInput>()
    })
    async getPluginById(input: PluginRefInput) {
        const plugin = await this.#service.getPluginById(input);
        return {
            summary: `Plugin "${plugin.modifier?.name ?? plugin._id}" (${plugin.status}).`,
            data: plugin
        };
    }

    @AITool({
        name: 'describe_plugin_arguments',
        description: 'Describe the configurable arguments a plugin accepts (key, type, default, range, options) so you can build a valid config before running it.',
        parameters: typia.llm.parameters<PluginRefInput>(),
        validate: typia.createValidate<PluginRefInput>()
    })
    async describePluginArguments(input: PluginRefInput) {
        const described = await this.#argumentDescriber.describePluginArguments(input);
        return {
            summary: `Plugin "${described.name}" accepts ${described.arguments.length} argument(s).`,
            data: described
        };
    }

    @AITool({
        name: 'compare_plugins',
        description: 'Compare two plugins side by side: their arguments, exposures, and workflow topology (node/edge counts and node-type composition). Useful for explaining how two analysis plugins differ.',
        parameters: typia.llm.parameters<ComparePluginsInput>(),
        validate: typia.createValidate<ComparePluginsInput>()
    })
    async comparePlugins(input: ComparePluginsInput) {
        const [pluginA, pluginB] = await Promise.all([
            this.#service.getPluginById({ pluginId: input.pluginIdA }),
            this.#service.getPluginById({ pluginId: input.pluginIdB })
        ]);

        const a = summarize(pluginA);
        const b = summarize(pluginB);

        const data = {
            a,
            b,
            argumentsDiff: diffSets(a.argumentKeys, b.argumentKeys),
            exposuresDiff: diffSets(a.exposureNames, b.exposureNames),
            topology: {
                nodeCountDelta: b.nodeCount - a.nodeCount,
                edgeCountDelta: b.edgeCount - a.edgeCount
            }
        };

        return {
            summary: `Compared "${a.name}" and "${b.name}": ${data.argumentsDiff.shared.length} shared arguments, ${data.exposuresDiff.shared.length} shared exposures; node counts ${a.nodeCount} vs ${b.nodeCount}.`,
            data
        };
    }

    @AITool({
        name: 'validate_workflow',
        description: 'Validate a plugin workflow graph (nodes + edges) in strict mode and report whether it is publishable, listing any structural errors. Pass pluginId to validate an existing plugin\'s draft graph.',
        parameters: typia.llm.parameters<ValidateWorkflowInput>(),
        validate: typia.createValidate<ValidateWorkflowInput>()
    })
    async validateWorkflow(input: ValidateWorkflowInput) {
        const validation = await this.#service.validateWorkflow({
            ...input,
            workflow: input.workflow as unknown as WorkflowProps
        });

        const summary = validation.validated
            ? 'Workflow is valid and publishable.'
            : `Workflow is invalid: ${(validation.errors ?? []).join('; ') || 'see errors.'}`;
        return {
            summary,
            data: validation
        };
    }

    @AITool({
        name: 'publish_plugin',
        description: 'Publish a plugin by transitioning it from Draft to Published. The existing workflow is strictly validated first; publishing fails if it is not valid.',
        parameters: typia.llm.parameters<PluginRefInput>(),
        validate: typia.createValidate<PluginRefInput>(),
        needsApproval: true
    })
    async publishPlugin(input: PluginRefInput) {
        const plugin = await this.#service.updatePluginById({
            ...input,
            status: PluginStatus.PUBLISHED
        });

        return {
            summary: `Published plugin "${plugin.modifier?.name ?? plugin._id}".`,
            data: plugin
        };
    }

    @AITool({
        name: 'uninstall_plugin',
        description: 'Remove a plugin from the team.',
        parameters: typia.llm.parameters<UninstallPluginInput>(),
        validate: typia.createValidate<UninstallPluginInput>()
    })
    async uninstallPlugin(input: UninstallPluginInput) {
        return this.#service.deletePluginById(input);
    }

    @AITool({
        name: 'execute_pipeline',
        description: 'Run an analysis pipeline on a trajectory: an ORDERED list of plugin stages executed sequentially on the team cluster. This is the ONLY way to run analysis — there is no single-plugin path. To run just one plugin, pass a one-stage pipeline. Stages run in array order against one evolving frame, so a stage that requiresExposures (see list_plugins) must come AFTER a stage whose producesExposures includes those ids (e.g. a reconstruction stage that emits a cluster table before a dislocation stage that consumes it). Call describe_plugin_arguments per plugin first to build each stage config. Returns the analysisId of every computed stage, in order, to track with get_analysis.',
        parameters: typia.llm.parameters<ExecutePipelineInput>(),
        validate: typia.createValidate<ExecutePipelineInput>(),
        needsApproval: true
    })
    async executePipeline(input: ExecutePipelineInput & AIToolScope) {
        const { analysisIds } = await this.#service.executePipeline({
            ...input,
            // typia validates but does not transform, so each stage's documented
            // `config` default is applied here.
            stages: input.stages.map((stage) => ({
                kind: 'plugin',
                pluginId: stage.pluginId,
                config: stage.config ?? {}
            }))
        });

        const summary = analysisIds.length
            ? `Started a ${input.stages.length}-stage pipeline. Computed analyses (in order): ${analysisIds.join(', ')}. Track each with get_analysis.`
            : 'Every pipeline stage was served from cache; no new analysis was created.';
        return {
            summary,
            data: { analysisIds }
        };
    }

    @AITool({
        name: 'list_plugin_listing_documents',
        description: 'List a plugin exposure\'s result rows as tabular metadata.',
        parameters: typia.llm.parameters<ListPluginListingDocumentsInput>(),
        validate: typia.createValidate<ListPluginListingDocumentsInput>()
    })
    async listPluginListingDocuments(input: ListPluginListingDocumentsInput & AIToolScope) {
        const { total, data } = await this.#service.getPluginListingDocuments(input);
        return {
            summary: `Found ${total} listing rows.`,
            data
        };
    }

    @AITool({
        name: 'list_analysis_result_options',
        description: 'List the result exposures and sub-listings produced by an analysis, so you know what can be summarized or read before requesting it.',
        parameters: typia.llm.parameters<ListAnalysisResultOptionsInput>(),
        validate: typia.createValidate<ListAnalysisResultOptionsInput>()
    })
    async listAnalysisResultOptions(input: ListAnalysisResultOptionsInput & AIToolScope) {
        const options = await this.#service.getAnalysisListingExportOptions(input);

        return {
            summary: `Analysis has ${options.listings.length} listing(s) and ${options.subListings.length} sub-listing(s).`,
            data: options
        };
    }

    @AITool({
        name: 'read_analysis_result_rows',
        description: 'Read individual rows of an analysis result table (paginated) when you need concrete values rather than aggregate statistics.',
        parameters: typia.llm.parameters<ReadAnalysisResultRowsInput>(),
        validate: typia.createValidate<ReadAnalysisResultRowsInput>()
    })
    async readAnalysisResultRows(input: ReadAnalysisResultRowsInput & AIToolScope) {
        const rows = await this.#service.getListingRowsByAnalysisId(input);

        return {
            summary: `Returned ${rows.data.length} of ${rows.total} result rows (page ${rows.page}/${rows.totalPages || 1}).`,
            data: rows
        };
    }

    @AITool({
        name: 'get_sub_listing',
        description: 'Fetch the rows of a nested sub-listing within a plugin exposure for a specific trajectory timestep (paginated). Use when a result row drills down into a secondary table.',
        parameters: typia.llm.parameters<GetSubListingInput>(),
        validate: typia.createValidate<GetSubListingInput>()
    })
    async getSubListing(input: GetSubListingInput & AIToolScope) {
        const subListing = await this.#service.getSubListing(input);

        return {
            summary: `Sub-listing "${subListing.subListingName}" returned ${subListing.rows.length} of ${subListing.total} rows (page ${subListing.page}/${subListing.totalPages || 1}).`,
            data: subListing
        };
    }

    @AITool({
        name: 'summarize_analysis_result',
        description: 'Summarize an analysis result into per-column statistics (numeric: count/min/max/mean/stddev; categorical: distinct count and top values) so you can reason about the scientific output.',
        parameters: typia.llm.parameters<SummarizeAnalysisResultInput>(),
        validate: typia.createValidate<SummarizeAnalysisResultInput>()
    })
    async summarizeAnalysisResult(input: SummarizeAnalysisResultInput & AIToolScope) {
        const summarized = await this.#summarizer.summarizeAnalysisResult(input);

        if (!summarized.hasResults) {
            return {
                summary: summarized.note ?? 'No results available.',
                data: summarized
            };
        }

        const columnCount = summarized.exposures.reduce((sum, exposure) => sum + exposure.columns.length, 0);
        const summary = `Analysis "${summarized.pluginDisplayName}"${summarized.trajectoryName ? ` on trajectory "${summarized.trajectoryName}"` : ''}: `
            + `${summarized.rowCount.toLocaleString('en-US')} rows across ${summarized.exposures.length} exposure(s), ${columnCount} columns summarized.`;

        return {
            summary,
            data: summarized
        };
    }

    @AITool({
        name: 'export_analysis_result',
        description: 'Produce a downloadable export (JSON or CSV) of all listing rows for an analysis. Returns export metadata (filename, format, headers); it does not stream the file contents into the chat.',
        parameters: typia.llm.parameters<ExportAnalysisResultInput>(),
        validate: typia.createValidate<ExportAnalysisResultInput>()
    })
    async exportAnalysisResult(input: ExportAnalysisResultInput & AIToolScope) {
        const { headers } = await this.#service.exportListingRowsByAnalysisId({
            ...input,
            format: input.format as ExportType | undefined
        });

        const filename = headers['Content-Disposition'] ?? headers['content-disposition'];
        const contentType = headers['Content-Type'] ?? headers['content-type'];

        return {
            summary: `Prepared an export for analysis ${input.analysisId} (${input.format ?? ExportType.Json}). Download it from the analysis export endpoint.`,
            data: {
                analysisId: input.analysisId,
                format: input.format ?? ExportType.Json,
                filename,
                contentType,
                note: 'Export prepared. Binary contents are not included in chat; use the download endpoint to retrieve the file.'
            }
        };
    }
}
