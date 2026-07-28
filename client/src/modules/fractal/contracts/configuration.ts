export interface ConfigurationState {
    activeSidebarOption: string;
    activeModifier: string;
}

export interface ConfigurationActions {
    setActiveModifier: (modifier: string) => void;
    setActiveSidebarOption: (option: string) => void;
    reset: () => void;
}

export type ConfigurationStore = ConfigurationState & ConfigurationActions;
