import { create } from 'zustand';

interface EditorUIState{
    showCanvasGrid: boolean;
    showEditorWidgets: boolean;
    activeModifiers: string[];
}

interface EditorUIActions{
    toggleCanvasGrid: () => void;
    toggleModifier: (modifier: string) => void;
    toggleEditorWidgets: () => void;
}

export type EditorUIStore = EditorUIState & EditorUIActions;

const initialState = {
    showCanvasGrid: true,
    showEditorWidgets: true,
    activeModifiers: []
};

const useEditorUIStore = create<EditorUIStore>((set) => {
    return {
        ...initialState,

        toggleModifier(modifier: string){
            const modifiers = new Set(this.activeModifiers);
            if(modifiers.has(modifier)){
                modifiers.delete(modifier);
            }else{
                modifiers.add(modifier);
            }

            set({ activeModifiers: Array.from(modifiers) })
        },

        toggleCanvasGrid(){
            return { showCanvasGrid: !this.showCanvasGrid }
        },

        toggleEditorWidgets(){
            return { showEditorWidgets: !this.showEditorWidgets }
        },
    };
});

export default useEditorUIStore;