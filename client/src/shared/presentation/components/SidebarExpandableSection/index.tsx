import { useState } from 'react';
import { IoChevronDown } from 'react-icons/io5';
import type { IconType } from 'react-icons';
import Container from '@/shared/presentation/components/Container';
import '@/shared/presentation/components/SidebarSubItems/SidebarSubItems.css';
import './SidebarExpandableSection.css';

export interface SubItem {
    label: string;
    isSelected?: boolean;
    onClick?: () => void;
    subItems?: SubItem[];
};

interface SidebarExpandableSectionProps {
    label: string;
    icon: IconType;
    isActive?: boolean;
    subItems: SubItem[];
    defaultExpanded?: boolean;
    expanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
};

const SidebarExpandableSection = ({
    label,
    icon: Icon,
    isActive = false,
    subItems,
    defaultExpanded = false,
    expanded: controlledExpanded,
    onExpandedChange
}: SidebarExpandableSectionProps) => {
    const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
    
    const isControlled = controlledExpanded !== undefined;
    const expanded = isControlled ? controlledExpanded : internalExpanded;

    const handleToggle = () => {
        const newExpanded = !expanded;
        if (isControlled) {
            onExpandedChange?.(newExpanded);
        } else {
            setInternalExpanded(newExpanded);
        }
    };

    const renderSubItem = (item: SubItem, index: number) => {
        const hasChildren = Boolean(item.subItems?.length);

        if (!hasChildren) {
            return (
                <button
                    key={index}
                    className={`sidebar-sub-item ${item.isSelected ? 'is-selected' : ''} w-max color-secondary cursor-pointer`}
                    onClick={item.onClick}
                >
                    {item.label}
                </button>
            );
        }

        const childSelected = Boolean(item.subItems?.some((subItem) => subItem.isSelected));

        return (
            <NestedSubItems
                key={index}
                item={item}
                childSelected={childSelected}
            />
        );
    };

    return (
        <>
            <button
                className={`sidebar-nav-item sidebar-section-header ${isActive ? 'is-selected' : ''} p-relative gap-075 w-max font-size-2 font-weight-4 color-secondary cursor-pointer`}
                onClick={handleToggle}
            >
                <Container className='sidebar-nav-icon font-size-4'>
                    <Icon />
                </Container>
                <span className='sidebar-nav-label'>{label}</span>
                <IoChevronDown
                    className={`sidebar-section-chevron ${expanded ? 'is-expanded' : ''} color-muted`}
                    size={14}
                />
            </button>

            {expanded && (
                <Container className='sidebar-sub-items'>
                    {subItems.map(renderSubItem)}
                </Container>
            )}
        </>
    );
};

interface NestedSubItemsProps {
    item: SubItem;
    childSelected: boolean;
}

const NestedSubItems = ({ item, childSelected }: NestedSubItemsProps) => {
    const [expanded, setExpanded] = useState(childSelected);
    const children = item.subItems || [];

    return (
        <Container className='sidebar-nested-section'>
            <button
                className={`sidebar-sub-item sidebar-nested-header ${item.isSelected || childSelected ? 'is-selected' : ''} w-max color-secondary cursor-pointer`}
                onClick={() => setExpanded((value) => !value)}
            >
                <span>{item.label}</span>
                <IoChevronDown
                    className={`sidebar-nested-chevron ${expanded ? 'is-expanded' : ''}`}
                    size={12}
                />
            </button>

            {expanded && (
                <Container className='sidebar-nested-items'>
                    {children.map((subItem, index) => (
                        <button
                            key={`${item.label}-${index}`}
                            className={`sidebar-nested-item ${subItem.isSelected ? 'is-selected' : ''} w-max color-secondary cursor-pointer`}
                            onClick={subItem.onClick}
                        >
                            {subItem.label}
                        </button>
                    ))}
                </Container>
            )}
        </Container>
    );
};

export default SidebarExpandableSection;
