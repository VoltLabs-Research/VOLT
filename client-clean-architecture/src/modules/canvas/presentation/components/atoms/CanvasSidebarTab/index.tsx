import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import Title from '@/shared/presentation/components/Title';
import '@/modules/canvas/presentation/components/atoms/CanvasSidebarTab/CanvasSidebarTab.css';

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
