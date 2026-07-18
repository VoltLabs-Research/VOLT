export interface INotebookRuntimeTerminator {
    terminate(teamClusterId: string, runtimeNotebookId: string): Promise<boolean>;
}
