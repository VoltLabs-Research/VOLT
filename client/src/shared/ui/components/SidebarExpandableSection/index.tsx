import { Button, cn } from '@heroui/react';
import NestedSubItems from './NestedSubItems';
import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useState, forwardRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { SubItem } from '@/shared/contracts/sidebar';

interface SidebarExpandableSectionProps {
    label: string;
    icon: LucideIcon;
    isActive?: boolean;
    subItems: SubItem[];
    defaultExpanded?: boolean;
    expanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    disabled?: boolean;
    onRequestSidebarExpand?: () => void;
};

/**
 * The section header is the same row as SidebarNavItem — it carried both
 * `.sidebar-nav-item` and `.sidebar-section-header`, and the latter only set
 * `justify-content: flex-start`, which is already the row's own alignment.
 *
 * `sidebar-nav-item`, `sidebar-nav-label`, `sidebar-section-chevron` and
 * `sidebar-sub-items` stay on the DOM as markers with no styling of their own:
 * `modules/dashboard/components/DashboardSidebar/DashboardSidebar.css` selects all
 * four to collapse the dashboard rail, and that sheet is another agent's to migrate.
 */
const NAV_ITEM = 'sidebar-nav-item relative flex w-full min-h-12 items-center justify-start gap-3 rounded-lg border border-transparent px-3.5 py-2.5 text-left text-sm cursor-pointer transition-[all] duration-150 ease-out-fluid';
const NAV_ITEM_SELECTED = 'is-selected bg-accent-soft font-medium text-foreground hover:bg-accent-soft-hover focus-visible:bg-accent-soft';
const NAV_ITEM_IDLE = 'font-normal text-muted hover:bg-surface-hover hover:text-foreground focus-visible:bg-surface-hover focus-visible:text-foreground';

const NAV_ICON = 'sidebar-nav-icon flex size-5 shrink-0 items-center justify-center text-xl leading-none';
const NAV_ICON_GLYPH = 'block size-[1em] mx-0 my-0';

const CHEVRON = 'sidebar-section-chevron ml-auto shrink-0 text-muted transition-transform duration-150 ease-out-fluid';
const SUB_ITEMS_LIST = 'sidebar-sub-items ml-8 mt-1 mb-1 list-none p-0';

const SUB_ITEM = 'flex w-full min-h-10 items-center justify-start rounded-lg border border-transparent px-3 py-2 text-left text-[0.8rem] cursor-pointer transition-[all] duration-150 ease-out-fluid';
const SUB_ITEM_SELECTED = 'is-selected bg-accent-soft font-medium text-foreground hover:bg-accent-soft-hover focus-visible:bg-accent-soft-hover';
const SUB_ITEM_IDLE = 'text-muted hover:bg-surface-hover hover:text-foreground focus-visible:bg-surface-hover focus-visible:text-foreground';

const SidebarExpandableSection = forwardRef<HTMLDivElement, SidebarExpandableSectionProps>(({
    label,
    icon: Icon,
    isActive = false,
    subItems,
    defaultExpanded = false,
    expanded: controlledExpanded,
    onExpandedChange,
    disabled = false,
    onRequestSidebarExpand
}, ref) => {
    const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
    const subItemsId = useId();

    const isControlled = controlledExpanded !== undefined;
    const expanded = isControlled ? controlledExpanded : internalExpanded;

    const handleToggle = () => {
        if (disabled) return;
        const newExpanded = !expanded;
        if (newExpanded) {
            onRequestSidebarExpand?.();
        }
        if (isControlled) {
            onExpandedChange?.(newExpanded);
        } else {
            setInternalExpanded(newExpanded);
        }
    };

    useEffect(() => {
        if (!isControlled && isActive) {
            setInternalExpanded(true);
        }
    }, [isActive, isControlled]);

    const renderSubItem = (item: SubItem) => {
        const hasChildren = Boolean(item.subItems?.length);

        if (!hasChildren) {
            return (
                <Button
                    variant='ghost'
                    className={cn(SUB_ITEM, item.isSelected ? SUB_ITEM_SELECTED : SUB_ITEM_IDLE)}
                    onPress={item.onClick}
                    aria-current={item.isSelected ? 'page' : undefined}
                >
                    <span className='truncate'>{item.label}</span>
                </Button>
            );
        }

        const childSelected = Boolean(item.subItems?.some((subItem) => subItem.isSelected));

        return (
            <NestedSubItems
                item={item}
                childSelected={childSelected}
            />
        );
    };

    return (
        <div ref={ref}>
            <Button
                variant='ghost'
                className={cn(NAV_ITEM, isActive ? NAV_ITEM_SELECTED : NAV_ITEM_IDLE)}
                onPress={handleToggle}
                isDisabled={disabled}
                aria-expanded={expanded}
                aria-controls={subItemsId}
            >
                <div className={NAV_ICON}>
                    <Icon size='1em' className={NAV_ICON_GLYPH} />
                </div>
                <span className='sidebar-nav-label flex-1 truncate'>{label}</span>
                <ChevronDown
                    className={expanded ? `${CHEVRON} rotate-180` : CHEVRON}
                    size={14}
                    aria-hidden='true'
                />
            </Button>

            {expanded && !disabled && (
                <ul id={subItemsId} className={SUB_ITEMS_LIST} role='list'>
                    {subItems.map((item, index) => (
                        <li key={item.label || index} className='list-none'>
                            {renderSubItem(item)}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
});

SidebarExpandableSection.displayName = 'SidebarExpandableSection';

export default SidebarExpandableSection;
