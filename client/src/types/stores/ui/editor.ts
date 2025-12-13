import type { ActiveModifier } from "@/stores/ui/editor";

export interface EditorUIState{
    showCanvasGrid: boolean;
    showEditorWidgets: boolean;
    activeModifiers: ActiveModifier[];
    isSceneInteracting: boolean;
    showRenderConfig: boolean;
}

export interface EditorUIActions{
    toggleCanvasGrid: () => void;
    toggleModifier: (modifierKey: string, pluginId?: string, modifierId?: string) => void;
    toggleEditorWidgets: () => void;
    setShowRenderConfig: (enabled: boolean) => void;
    setSceneInteracting: (isInteracting: boolean) => void;
    reset: () => void;
}

export type EditorUIStore = EditorUIState & EditorUIActions;
