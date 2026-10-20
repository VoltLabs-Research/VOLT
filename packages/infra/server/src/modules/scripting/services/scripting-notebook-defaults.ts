export const DEFAULT_SCRIPTING_NOTEBOOK_TITLE = 'Untitled Notebook';

export const buildScriptingNotebookPath = (suffix: string): string => {
    return `scripting-notebook-${suffix}.ipynb`;
};
