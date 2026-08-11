import RightCollapsible, { PANEL_ICON_STYLE } from './RightCollapsible';
import { formatArtifactLabel } from './artifact-labels';
import { TIMESTEP_PAGE_SIZE } from './use-artifact-sections';
import { isSameScene, toSceneObjectFromArtifact } from '@/modules/canvas/utils/scene-identity';
import { getSceneKey } from '@/modules/fractal/utils/scene-utils';
import { useEditorStore } from '@/modules/canvas/store/editor';
import {
    CanvasTreeEmptyRow,
    CanvasTreeRow,
    MaybeContextMenu
} from '../CanvasTree';
import {
    buildAddRemoveOption,
    buildColorSubmenu,
    buildTransparencySubmenu,
    colorOption,
    transparencyOption
} from '../../utils/tree-menus';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@heroui/react';
import { useShallow } from 'zustand/react/shallow';

import type { ArtifactSection } from './use-artifact-sections';
import type { MenuOption } from '@/shared/contracts/menu';
import type { SceneArtifact } from '@volt/contracts/modules/trajectory/domain';
import type { SceneObjectType } from '@/modules/fractal/contracts/scene';

const ROW_ICON_STYLE = {
    width: 12,
    height: 12,
    color: 'var(--accent)'
} as const;

const CHEVRON_STYLE = {
    width: 13,
    height: 13
} as const;

interface ArtifactTreeSectionProps {
    section: ArtifactSection;
    isLoading: boolean;
    activeScene: SceneObjectType | null;
    onSelectScene: (scene: SceneObjectType) => void;
    isSceneActive: (scene: SceneObjectType) => boolean;
    onAddScene: (scene: SceneObjectType) => void;
    onRemoveScene: (scene: SceneObjectType) => void;
}

const ArtifactTreeSection = ({
    section,
    isLoading,
    activeScene,
    onSelectScene,
    isSceneActive,
    onAddScene,
    onRemoveScene
}: ArtifactTreeSectionProps) => {
    const {
        sceneVisualOverrides,
        setSceneOpacity,
        setSceneColor,
        setCurrentTimestep
    } = useEditorStore(useShallow((state) => ({
        sceneVisualOverrides: state.sceneVisualOverrides,
        setSceneOpacity: state.setSceneOpacity,
        setSceneColor: state.setSceneColor,
        setCurrentTimestep: state.setCurrentTimestep
    })));

    const { icon: Icon, timesteps, artifactsByTimestep, expandedTimesteps, visibleCount } = section;

    const buildMenuOptions = (scene: SceneObjectType, artifact: SceneArtifact): MenuOption[] => {
        const sceneKey = getSceneKey(scene);

        return [
            buildAddRemoveOption({
                isActive: isSceneActive(scene),
                onAdd: () => {
                    setCurrentTimestep(artifact.timestep);
                    onAddScene(scene);
                },
                onRemove: () => onRemoveScene(scene)
            }),
            transparencyOption(buildTransparencySubmenu(sceneVisualOverrides[sceneKey]?.opacity ?? 1, (value) => setSceneOpacity(sceneKey, value))),
            colorOption(buildColorSubmenu(sceneVisualOverrides[sceneKey]?.color, (value) => setSceneColor(sceneKey, value)))
        ];
    };

    const renderArtifactRow = (artifact: SceneArtifact) => {
        const scene = toSceneObjectFromArtifact(artifact);
        const label = formatArtifactLabel(artifact);

        return (
            <MaybeContextMenu
                key={artifact._id}
                enabled={!!scene}
                id={`canvas-ctx-${section.id}-${artifact._id}`}
                options={scene ? buildMenuOptions(scene, artifact) : []}
            >
                <CanvasTreeRow
                    indent='lg'
                    isActive={!!scene && isSameScene(activeScene, scene)}
                    icon={<Icon style={ROW_ICON_STYLE} />}
                    label={label}
                    onClick={() => {
                        if (!scene) return;
                        setCurrentTimestep(artifact.timestep);
                        onSelectScene(scene);
                    }}
                />
            </MaybeContextMenu>
        );
    };

    const renderTimestepGroup = (timestep: number) => {
        const group = artifactsByTimestep.get(timestep) ?? [];
        const isExpanded = expandedTimesteps.has(timestep);
        const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;
        const groupId = `canvas-ctx-${section.id}-group-${timestep}`;

        return (
            <div key={timestep} className='mt-1' role='treeitem' aria-expanded={isExpanded} aria-level={1}>
                <button
                    type='button'
                    id={groupId}
                    className={cn('flex items-center gap-2', 'w-full cursor-pointer rounded-md border-none bg-transparent px-1.5 py-1 text-left text-muted hover:bg-surface-hover')}
                    onClick={() => section.toggleTimestep(timestep)}
                    aria-expanded={isExpanded}
                    aria-controls={isExpanded ? `${groupId}-children` : undefined}
                >
                    <ChevronIcon className={cn('transition-transform duration-150 ease-out', !isExpanded && '-rotate-90')} style={CHEVRON_STYLE} />
                    <span className='min-w-0 flex-1 truncate'>{timestep}</span>
                    <span className='text-[11px] text-muted'>{group.length}</span>
                </button>

                {isExpanded && (
                    <div id={`${groupId}-children`} role="group">
                        {group.map(renderArtifactRow)}
                    </div>
                )}
            </div>
        );
    };

    const hiddenCount = Math.max(0, timesteps.length - visibleCount);

    return (
        <RightCollapsible
            title={section.title}
            icon={<Icon style={PANEL_ICON_STYLE} />}
            expanded={section.open}
            onExpandedChange={section.setOpen}
        >
            <div className='canvas-tree-container flex flex-col gap-1 overflow-auto px-2 pb-2.5 pt-1.5' role='tree' aria-label={section.ariaLabel}>
                {timesteps.length === 0 ? (
                    <CanvasTreeEmptyRow label={isLoading ? 'Loading...' : 'No models generated'} />
                ) : (
                    timesteps.slice(0, visibleCount).map(renderTimestepGroup)
                )}

                {hiddenCount > 0 && (
                    <button
                        type='button'
                        className='mx-2 mb-1.5 mt-1 cursor-pointer rounded-md border border-dashed border-border bg-transparent px-2.5 py-1.5 text-center text-xs text-muted transition-[background-color,border-color] duration-[120ms] ease-out hover:border-border-secondary hover:bg-surface-hover'
                        onClick={section.showMoreTimesteps}
                    >
                        Show {Math.min(TIMESTEP_PAGE_SIZE, hiddenCount)} more timesteps ({hiddenCount} hidden)
                    </button>
                )}
            </div>
        </RightCollapsible>
    );
};

export default ArtifactTreeSection;
