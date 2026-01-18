import { injectable, inject } from 'tsyringe';
import { INodeHandler, ExecutionContext, NodeOutputSchema, T } from '@modules/plugin/domain/ports/INodeRegistry';
import { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/ITrajectoryDumpStorageService';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { WorkflowNode, WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';

@injectable()
export default class ArgumentsHandler implements INodeHandler{
    readonly type = WorkflowNodeType.Arguments;

    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryDumpStorageService)
        private dumpStorage: ITrajectoryDumpStorageService
    ){}

    readonly outputSchema: NodeOutputSchema = {
        properties: {
            as_str: T.string('All arguments as single string'),
            as_array: T.array(T.string(), 'Arguments as array')
        }
    };

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<Record<string, any>>{
        const argDefs = node.data.arguments?.arguments || [];

        // Reduce inputs into a single state object { values, cliArgs }
        const { values, cliArgs } = await argDefs.reduce(async (promiseAcc, argDef) => {
            const acc = await promiseAcc;

            // Resolve Value: Value > User Input > Default
            let value = argDef.value ?? context.userConfig[argDef.argument] ?? argDef.default;

            // Special Resolver: Frame -> Dump Path
            if(argDef.type === 'frame' && value !== null){
                // Ensure value is treated as string for the service
                const dumpPath = await this.dumpStorage.getDump(context.trajectoryId, String(value));
                if(dumpPath) value = dumpPath;
            }

            // Store raw value
            acc.values[argDef.argument] = value;

            // Store CLI formatted arg if valid
            if(value !== null){
                if(argDef.type === 'boolean'){
                    if(String(value) === 'true') acc.cliArgs.push(`--${argDef.argument}`);
                }else{
                    acc.cliArgs.push(`--${argDef.argument}`, String(value));
                }
            }

            return acc;
        }, Promise.resolve({
            values: {} as Record<string, any>, 
            cliArgs: [] as string[] 
        }));

        return {
            as_str: cliArgs.join(' '),
            as_array: cliArgs,
            ...values
        };
    }
};