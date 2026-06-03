import { GetNodeTypesSchemaOutputDTO } from '@modules/plugin/application/dtos/plugin/GetNodeTypesSchemaDTO';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

const NODE_OUTPUT_PROPERTIES: Record<string, string[]> = {
    [WorkflowNodeType.Modifier]: ['pluginId', 'trajectory', 'analysis'],
    [WorkflowNodeType.Arguments]: ['as_str', 'as_array', 'selectedTimesteps'],
    [WorkflowNodeType.Context]: ['trajectory_dumps', 'count', 'trajectory'],
    [WorkflowNodeType.ForEach]: ['items', 'count', 'currentValue', 'currentValue.path', 'currentValue.frame', 'currentIndex', 'outputPath'],
    [WorkflowNodeType.Entrypoint]: ['results', 'successCount', 'failCount', 'stdout', 'stderr', 'exitCode', 'projectPath'],
    [WorkflowNodeType.Plugin]: ['execution_result', 'execution_result.exposures', 'execution_result.exposures.items', 'execution_result.exposures.str_json'],
    [WorkflowNodeType.Exposure]: ['results', 'sample'],
    [WorkflowNodeType.Export]: ['results'],
    [WorkflowNodeType.IfStatement]: ['result', 'branch'],
    [WorkflowNodeType.SwitchStatement]: ['expression', 'resolvedValue', 'matchedCaseId', 'matchedValue'],
    [WorkflowNodeType.SwitchCase]: ['value', 'defaultCase']
};

@Singleton()
export default class GetNodeTypesSchemaUseCase implements IUseCase<void, GetNodeTypesSchemaOutputDTO> {
    async execute(): Promise<Result<GetNodeTypesSchemaOutputDTO>> {
        return Result.ok({
            nodeTypes: NODE_OUTPUT_PROPERTIES
        });
    }
}
