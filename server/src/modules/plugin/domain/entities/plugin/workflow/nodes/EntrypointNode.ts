export enum EntrypointNodeType {
    Executable = 'executable',
    PythonScript = 'python-script'
};

export interface EntrypointNodeData{
    binary?: string;
    binaryObjectPath?: string;
    binaryFileName?: string;
    type?: EntrypointNodeType;
    arguments: string;
    requirementsFile?: string;
    entrypointScript?: string;
    timeout?: number;
};
