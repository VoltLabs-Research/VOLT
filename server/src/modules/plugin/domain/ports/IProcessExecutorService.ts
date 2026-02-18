export interface ExecutionResult{
    code: number;
    stdout: string;
    stderr: string;
};

export interface IProcessExecutorService{
    execute(
        commandPath: string,
        args: string[],
        cwd?: string
    ): Promise<ExecutionResult>;
};