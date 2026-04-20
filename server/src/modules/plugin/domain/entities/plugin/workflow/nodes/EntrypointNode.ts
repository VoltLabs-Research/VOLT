export enum EntrypointNodeType {
    Executable = 'executable',
    PythonScript = 'python-script',
    PackagedExecutable = 'packaged-executable'
};

export interface EntrypointNodeData{
    binary?: string;
    binaryObjectPath?: string;
    binaryFileName?: string;
    binaryHash?: string;
    type?: EntrypointNodeType;
    arguments: string;
    requirementsFile?: string;
    entrypointScript?: string;
    timeout?: number;
};
