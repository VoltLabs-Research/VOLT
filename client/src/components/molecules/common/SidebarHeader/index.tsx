import { LuPanelRight } from "react-icons/lu";

interface SidebarHeaderProps {
    collapsed?: boolean;
    onToggle?: () => void;
    children: React.ReactNode;
}

const SidebarHeader = ({ collapsed, onToggle, children }: SidebarHeaderProps) => {
    return (
        <div className="editor-sidebar-header-container">
            <div className="editor-sidebar-header-content">
                {children}
            </div>

            <button
                className="editor-sidebar-toggle-btn"
                onClick={onToggle}
            >
                <LuPanelRight 
                    className={`editor-sidebar-toggle-icon ${collapsed ? "rotated" : ""}`} 
                />
            </button>
        </div>
    );
};

export default SidebarHeader;
