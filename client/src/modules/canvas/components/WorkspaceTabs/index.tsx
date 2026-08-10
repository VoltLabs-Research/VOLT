import { cn } from '@heroui/react';
import useCanvasUrlState, { CanvasWorkspace } from '../../hooks/use-canvas-url-state';

interface WorkspaceTabsProps {
    disableAuxWorkspaces?: boolean;
    /**
     * `TopToolbar.css` shrank these tabs inside `.canvas-toolbar-options--mobile`
     * (1px gap, no padding, 26px tall, 10px type). That container is `display: none`
     * above 768px, so the override needed no media query of its own and needs no
     * ancestor variant here — the mobile toolbar simply asks for the compact size.
     */
    compact?: boolean;
}

interface TabDef {
    id: CanvasWorkspace;
    label: string;
    auxOnly?: boolean;
}

const TABS: TabDef[] = [
    {
        id: CanvasWorkspace.Scene,
        label: 'Scene'
    },
    {
        id: CanvasWorkspace.Raster,
        label: 'Raster',
        auxOnly: true
    }
];

/**
 * `.canvas-workspace-tabs` / `.canvas-workspace-tab`.
 *
 * The `:focus-visible` box-shadow ring is gone rather than translated: `index.css`
 * rings every plain interactive element with `outline: 2px solid var(--focus)`.
 *
 * `--hover-bg` is `--surface-hover`, and the active and hover states painted the same
 * fill — only the ink differed (`--color-text-primary` vs `--color-text-secondary`,
 * which both collapse per spec §3a to `text-foreground` and `text-muted`).
 */
const TABS_CLASS = 'flex flex-row items-center gap-0.5 rounded-lg p-0.5 max-md:min-w-0 max-md:flex-1 max-md:flex-nowrap max-md:overflow-x-auto max-md:overflow-y-hidden max-md:[&>*]:shrink-0';

const TABS_COMPACT_CLASS = 'gap-[1px] p-0';

const TAB_CLASS = 'inline-flex h-8 cursor-pointer appearance-none items-center justify-center rounded-md border-none bg-transparent px-3 text-[0.8125rem] font-medium leading-none text-muted select-none transition-[background-color,color] duration-[140ms] ease-out';

const TAB_COMPACT_CLASS = 'h-[1.625rem] px-1.5 text-[0.625rem]';

const WorkspaceTabs = ({ disableAuxWorkspaces = false, compact = false }: WorkspaceTabsProps) => {
    const { activeWorkspace, setActiveWorkspace } = useCanvasUrlState();

    return (
        <div className={cn(TABS_CLASS, compact && TABS_COMPACT_CLASS)}
            role='tablist'
            aria-label='Canvas workspace'
        >
            {TABS.map((tab) => {
                const isActive = activeWorkspace === tab.id;
                const isDisabled = tab.auxOnly && disableAuxWorkspaces;

                return (
                    <button
                        key={tab.id}
                        type='button'
                        role='tab'
                        aria-selected={isActive}
                        disabled={isDisabled}
                        className={cn(
                            TAB_CLASS,
                            compact && TAB_COMPACT_CLASS,
                            isActive && 'bg-surface-hover text-foreground',
                            !isActive && !isDisabled && 'hover:bg-surface-hover hover:text-muted',
                            isDisabled && 'cursor-not-allowed opacity-40'
                        )}
                        onClick={() => setActiveWorkspace(tab.id)}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
};

export default WorkspaceTabs;
