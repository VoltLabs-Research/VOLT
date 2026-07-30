import type { IArgumentDefinition } from '@volt/contracts/modules/plugin/workflow';

export interface ArgumentsNodeArguments {
    arguments?: IArgumentDefinition[];
}

export interface ArgumentsNodeData {
    arguments?: ArgumentsNodeArguments;
}
