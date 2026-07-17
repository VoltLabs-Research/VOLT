/** Sidebar expandable section sub-item configuration. */
export interface SubItem {
    label: string;
    isSelected?: boolean;
    onClick?: () => void;
    subItems?: SubItem[];
};
