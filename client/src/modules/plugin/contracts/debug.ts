import type { IArgumentDefinition } from '@volt/contracts/modules/plugin/domain/workflow';

export interface ArgumentsNodeArguments {
    arguments?: IArgumentDefinition[];
}

export interface ArgumentsNodeData {
    arguments?: ArgumentsNodeArguments;
}
