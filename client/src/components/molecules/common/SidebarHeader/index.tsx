import Container from "@/components/primitives/Container";
import { LuPanelRight } from "react-icons/lu";

interface SidebarHeaderProps {
    collapsed?: boolean;
    onToggle?: () => void;
    children: React.ReactNode;
}

const SidebarHeader = ({ collapsed, onToggle, children }: SidebarHeaderProps) => {
    return(
        <Container className="d-flex content-between p-1-5 sm:p-1 editor-sidebar-header-container">
            <Container className="d-flex column gap-05">
                {children}
            </Container>

            <button
                className="editor-sidebar-toggle-btn"
                onClick={onToggle}
            >
                <LuPanelRight
                    className={`editor-sidebar-toggle-icon ${collapsed ? "rotated" : ""}`}
                />
            </button>
        </Container>
    );
};

export default SidebarHeader;
