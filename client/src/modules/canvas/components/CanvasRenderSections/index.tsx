import CanvasRenderSubsectionContent from './CanvasRenderSubsectionContent';
import useCanvasRenderGroups from './useCanvasRenderGroups';

import { memo, useMemo, useState } from 'react';
import { CollapsibleSection } from '@/shared/presentation/primitives';
import './CanvasRenderSections.css';

interface CanvasRenderSectionsProps {
    excludeGroupIds?: string[];
};

const CanvasRenderSections = ({ excludeGroupIds = [] }: CanvasRenderSectionsProps) => {
    const [openGroupId, setOpenGroupId] = useState<string | null>(null);
    const [openSubsectionByGroup, setOpenSubsectionByGroup] = useState<Record<string, number[]>>({});
    const groups = useCanvasRenderGroups();

    const visibleGroups = useMemo(() => {
        const hiddenGroupIds = new Set(excludeGroupIds);

        return groups.filter((group) => {
            return group.visible !== false && !hiddenGroupIds.has(group.id);
        });
    }, [excludeGroupIds, groups]);

    return (
        <>
            {visibleGroups.map((group) => {
                const isOpen = openGroupId === group.id;
                const visibleSubsections = group.subsections.filter((sub) => sub.visible !== false);
                const hasSubsections = visibleSubsections.length > 1;
                const openIndices = openSubsectionByGroup[group.id] ?? [];

                return (
                    <CollapsibleSection
                        key={group.id}
                        title={group.title}
                        icon={group.icon}
                        expanded={isOpen}
                        onExpandedChange={() => setOpenGroupId((prev) => prev === group.id ? null : group.id)}
                        className="canvas-right-dropdown"
                        headerClassName="canvas-right-dropdown-header d-flex items-center gap-05"
                        titleClassName="canvas-right-dropdown-title font-size-05 color-muted"
                        iconClassName="canvas-right-dropdown-icon"
                        bodyClassName="canvas-right-dropdown-body"
                        contentClassName="d-flex column"
                        noSpacing
                        arrowSize={13}
                        useDefaultHeaderStyles={false}
                        useDefaultTitleStyles={false}
                    >
                        {visibleSubsections.map((sub, idx) => {
                            const isSubOpen = hasSubsections ? openIndices.includes(idx) : true;
                            const isSubDisabled = sub.disabled === true;

                            return (
                                <CollapsibleSection
                                    key={`${group.id}-${idx}`}
                                    title={sub.label}
                                    icon={sub.icon}
                                    expanded={isSubOpen}
                                    onExpandedChange={hasSubsections
                                        ? () =>
                                            setOpenSubsectionByGroup((prev) => {
                                                const current = prev[group.id] ?? [];
                                                const exists = current.includes(idx);
                                                const next = exists
                                                    ? current.filter((value) => value !== idx)
                                                    : [...current, idx];
                                                return { ...prev, [group.id]: next };
                                            })
                                        : undefined
                                    }
                                    className={`canvas-right-dropdown${isSubDisabled ? ' canvas-render-disabled' : ''}`}
                                    headerClassName="canvas-right-dropdown-header d-flex items-center gap-05"
                                    titleClassName="canvas-right-dropdown-title font-size-05 color-muted"
                                    iconClassName="canvas-right-dropdown-icon"
                                    bodyClassName="canvas-right-dropdown-body"
                                    contentClassName="d-flex column canvas-render-subsection-body"
                                    noSpacing
                                    arrowSize={13}
                                    useDefaultHeaderStyles={false}
                                    useDefaultTitleStyles={false}
                                >
                                    <CanvasRenderSubsectionContent subsection={sub} />
                                </CollapsibleSection>
                            );
                        })}
                    </CollapsibleSection>
                );
            })}
        </>
    );
};

export default memo(CanvasRenderSections);
