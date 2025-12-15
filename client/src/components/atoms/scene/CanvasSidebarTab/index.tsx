import useConfigurationStore from '@/stores/editor/configuration';
import Container from '@/components/primitives/Container';
import './CanvasSidebarTab.css';
import Title from '@/components/primitives/Title';

interface CanvasSidebarTabProps {
    option: string
};

const CanvasSidebarTab: React.FC<CanvasSidebarTabProps> = ({ option }) => {
    const setActiveSidebarTag = useConfigurationStore((state) => state.setActiveSidebarTag);
    const activeSidebarTab = useConfigurationStore((state) => state.activeSidebarTab);

    return (
        <div
            className={'d-flex content-center items-center editor-sidebar-option-container '.concat((option === activeSidebarTab) ? 'selected' : '')}
            onClick={() => setActiveSidebarTag(option)}
        >
            <Title className='font-size-3 editor-sidebar-option-title'>{option}</Title>
        </div>
    );
};

export default CanvasSidebarTab;
