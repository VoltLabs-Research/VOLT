import { useState } from 'react';
import { memo, useMemo } from 'react';
import useTrajectoryStore from '@/modules/trajectory/presentation/stores/use-trajectory-store';
import Sidebar from '@/shared/presentation/components/Sidebar';
import CanvasSidebarScene from '@/modules/canvas/presentation/components/molecules/CanvasSidebarScene';
import CanvasSidebarModifiers from '@/modules/canvas/presentation/components/molecules/CanvasSidebarModifiers';
import SidebarUserAvatar from '@/modules/auth/presentation/components/atoms/SidebarUserAvatar';
import EditableTrajectoryName from '@/modules/trajectory/presentation/components/atoms/EditableTrajectoryName';
import RenderSettingsContent from '@/modules/canvas/presentation/components/molecules/modifiers/RenderSettingsContent';
import { MdKeyboardArrowDown } from 'react-icons/md';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import '@/modules/canvas/presentation/components/organisms/EditorSidebar/EditorSidebar.css';

const EditorSidebar = () => {
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const [activeTab, setActiveTab] = useState('Scene');

    const tags = useMemo(() => {
        const SceneTab = () => (
            <CanvasSidebarScene trajectory={trajectory} trajectoryId={trajectory?._id} />
        );

        const RenderTab = () => (
            <Container>
                <RenderSettingsContent trajectoryId={trajectory?._id} />
            </Container>
        );

        const ModifiersTab = () => <CanvasSidebarModifiers />;

        return [
            { id: 'Scene', name: 'Scene', Component: SceneTab },
            { id: 'Modifiers', name: 'Modifiers', Component: ModifiersTab },
            { id: 'Render', name: 'Render', Component: RenderTab }
        ];
    }, [trajectory]);

    return (
        <Sidebar
            tags={tags}
            activeTag={activeTab}
            onTagChange={setActiveTab}
            keepMounted
        >
            <Sidebar.Header>
                <Container className='d-flex column gap-1 sm:gap-0'>
                    <Container className='d-flex content-between items-center'>
                        <Container className='d-flex gap-1 items-center'>
                            {trajectory ? (
                                <EditableTrajectoryName
                                    trajectoryId={trajectory._id}
                                    name={trajectory.name}
                                    className='editor-sidebar-trajectory-name'
                                />
                            ) : (
                                <Title className='editor-sidebar-trajectory-name'>Trajectory</Title>
                            )}

                            <i className='editor-sidebar-trajectory-drop-icon-container'>
                                <MdKeyboardArrowDown />
                            </i>
                        </Container>
                    </Container>
                </Container>

                {trajectory?.team && typeof trajectory.team !== 'string' && (
                    <Paragraph className='editor-sidebar-header-team-name'>
                        {trajectory.team.name}
                    </Paragraph>
                )}
            </Sidebar.Header>

            <Sidebar.Bottom>
                <Container className='editor-sidebar-user-avatar-wrapper p-1-5'>
                    <SidebarUserAvatar
                        avatarrounded={false}
                        hideEmail={true}
                    />
                </Container>
            </Sidebar.Bottom>
        </Sidebar>
    );
};

export default memo(EditorSidebar);
