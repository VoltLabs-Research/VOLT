export interface EditorUIState{
    showCanvasGrid: boolean;
    showEditorWidgets: boolean;
    activeModifiers: string[];
    isSceneInteracting: boolean;
    showRenderConfig: boolean;
}

export interface EditorUIActions{
    toggleCanvasGrid: () => void;
    toggleModifier: (modifier: string) => void;
    toggleEditorWidgets: () => void;
    setShowRenderConfig: (enabled: boolean) => void;
    setSceneInteracting: (isInteracting: boolean) => void;
    reset: () => void;
}

export type EditorUIStore = EditorUIState & EditorUIActions;