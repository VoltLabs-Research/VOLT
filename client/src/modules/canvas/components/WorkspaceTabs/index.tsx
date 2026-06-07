import useCanvasUrlState, { CanvasWorkspace } from '../../hooks/use-canvas-url-state';
import { Row } from '@voltstack/bravais';

import './WorkspaceTabs.css';

interface WorkspaceTabsProps {
    disableAuxWorkspaces?: boolean;
    showScriptingWorkspace?: boolean;
}

interface TabDef {
    id: CanvasWorkspace;
    label: string;
    auxOnly?: boolean;
}

const TABS: TabDef[] = [
    { id: CanvasWorkspace.Scene, label: 'Scene' },
    { id: CanvasWorkspace.Raster, label: 'Raster', auxOnly: true },
    { id: CanvasWorkspace.Scripting, label: 'Scripting', auxOnly: true }
];

const WorkspaceTabs = ({ disableAuxWorkspaces = false, showScriptingWorkspace = true }: WorkspaceTabsProps) => {
    const { activeWorkspace, setActiveWorkspace } = useCanvasUrlState();

    return (
        <Row
            role="tablist"
            aria-label="Canvas workspace"
            className="canvas-workspace-tabs"
        >
            {TABS.map((tab) => {
                if (tab.id === CanvasWorkspace.Scripting && !showScriptingWorkspace) {
                    return null;
                }

                const isActive = activeWorkspace === tab.id;
                const isDisabled = tab.auxOnly && disableAuxWorkspaces;

                return (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        disabled={isDisabled}
                        className={`canvas-workspace-tab${isActive ? ' is-active' : ''}`}
                        onClick={() => setActiveWorkspace(tab.id)}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </Row>
    );
};

export default WorkspaceTabs;
