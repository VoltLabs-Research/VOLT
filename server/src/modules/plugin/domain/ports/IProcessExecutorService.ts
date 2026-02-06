export interface ExecutionResult{
    code: number;
    stderr: string;
};

export interface IProcessExecutorService{
    execute(
        commandPath: string,
        args: string[],
        cwd?: string
    ): Promise<ExecutionResult>;
};