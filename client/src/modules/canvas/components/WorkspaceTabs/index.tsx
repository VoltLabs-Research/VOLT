import { cn } from '@heroui/react';
import useCanvasUrlState, { CanvasWorkspace } from '../../hooks/use-canvas-url-state';

interface WorkspaceTabsProps {
    disableAuxWorkspaces?: boolean;

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

const WorkspaceTabs = ({ disableAuxWorkspaces = false, compact = false }: WorkspaceTabsProps) => {
    const { activeWorkspace, setActiveWorkspace } = useCanvasUrlState();

    return (
        <div className={cn('flex flex-row items-center gap-0.5 rounded-lg p-0.5 max-md:min-w-0 max-md:flex-1 max-md:flex-nowrap max-md:overflow-x-auto max-md:overflow-y-hidden max-md:[&>*]:shrink-0', compact && 'gap-[1px] p-0')}
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
                            'inline-flex h-8 cursor-pointer appearance-none items-center justify-center rounded-md border-none bg-transparent px-3 text-[0.8125rem] font-medium leading-none text-muted select-none transition-[background-color,color] duration-[140ms] ease-out',
                            compact && 'h-[1.625rem] px-1.5 text-[0.625rem]',
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
