export interface EditorUIState{
    showCanvasGrid: boolean;
    showEditorWidgets: boolean;
    activeModifiers: string[];
}

export interface EditorUIActions{
    toggleCanvasGrid: () => void;
    toggleModifier: (modifier: string) => void;
    toggleEditorWidgets: () => void;
}

export type EditorUIStore = EditorUIState & EditorUIActions;