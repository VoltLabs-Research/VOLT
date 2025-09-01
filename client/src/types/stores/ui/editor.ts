export interface EditorUIState{
    showCanvasGrid: boolean;
    showEditorWidgets: boolean;
    activeModifiers: string[];
    isSceneInteracting: boolean;
}

export interface EditorUIActions{
    toggleCanvasGrid: () => void;
    toggleModifier: (modifier: string) => void;
    toggleEditorWidgets: () => void;
    setSceneInteracting: (isInteracting: boolean) => void;
}

export type EditorUIStore = EditorUIState & EditorUIActions;