
export interface SubItem {
    label: string;
    isSelected?: boolean;
    onClick?: () => void;
    subItems?: SubItem[];
};
