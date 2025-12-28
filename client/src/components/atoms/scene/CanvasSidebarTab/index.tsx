import { useEditorStore } from '@/stores/slices/editor';
import Container from '@/components/primitives/Container';
import './CanvasSidebarTab.css';
import Title from '@/components/primitives/Title';

interface CanvasSidebarTabProps {
    option: string
};

const CanvasSidebarTab: React.FC<CanvasSidebarTabProps> = ({ option }) => {
    const setActiveSidebarTag = useEditorStore((state) => state.configuration.setActiveSidebarTag);
    const activeSidebarTab = useEditorStore((state) => state.configuration.activeSidebarTab);

    return (
        <div
            className={'d-flex content-center items-center editor-sidebar-option-container '.concat((option === activeSidebarTab) ? 'selected' : '')}
            onClick={() => setActiveSidebarTag(option)}
        >
            <Title className='font-size-3 editor-sidebar-option-title font-weight-5'>{option}</Title>
        </div>
    );
};

export default CanvasSidebarTab;
