import { NodeType } from '@volt/contracts/modules/plugin/enums';
import type { IWorkflow } from '@volt/contracts/modules/plugin/workflow';
import type { AnalysisJobExecutionData } from '@shared/contracts/types/http-analysis';

const countEntrypoints = (workflow: IWorkflow): number =>
    workflow.nodes.filter((node) => node.type === NodeType.ENTRYPOINT).length;

// How many plugin processes one job of this analysis runs, one after another: the entrypoints of
// its workflow and of the plugins it calls. Each is an equal share of the job's progress.
export const countEntrypointSteps = ({ workflow }: AnalysisJobExecutionData): number =>
    countEntrypoints(workflow.definition)
    + workflow.nestedPlugins.reduce((total, nested) => total + countEntrypoints(nested.workflow), 0);
