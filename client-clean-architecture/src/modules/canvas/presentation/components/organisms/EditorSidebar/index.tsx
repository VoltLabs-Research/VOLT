import Sidebar from '@/shared/presentation/components/Sidebar';
import useTrajectoryStore from '@/modules/trajectory/presentation/stores/use-trajectory-store';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import CanvasSidebarModifiers from '@/modules/canvas/presentation/components/molecules/CanvasSidebarModifiers';
import CanvasSidebarScene from '@/modules/canvas/presentation/components/molecules/CanvasSidebarScene';
import SidebarUserAvatar from '@/modules/auth/presentation/components/atoms/SidebarUserAvatar';
import useCanvasUIStore from '@/modules/canvas/presentation/stores/use-canvas-ui-store';
import EditableTrajectoryName from '@/modules/trajectory/presentation/components/atoms/EditableTrajectoryName';
import { BsArrowLeft } from 'react-icons/bs';
import { MdKeyboardArrowDown } from 'react-icons/md';
import LightsControls from '@/modules/canvas/presentation/components/molecules/LightsControls';
import EffectsControls from '@/modules/canvas/presentation/components/molecules/EffectsControls';
import PerformanceSettingsControls from '@/modules/canvas/presentation/components/molecules/PerfomanceSettingsControls';
import EnvironmentControls from '@/modules/canvas/presentation/components/molecules/EnvironmentControls';
import CameraSettingsControls from '@/modules/canvas/presentation/components/molecules/CameraSettingsControls';
import RendererSettingsControls from '@/modules/canvas/presentation/components/molecules/RendererSettingsControls';
import CanvasGridControls from '@/modules/canvas/presentation/components/molecules/CanvasGridControls';
import OrbitControls from '@/modules/canvas/presentation/components/molecules/OrbitControls';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import '@/modules/canvas/presentation/components/organisms/EditorSidebar/EditorSidebar.css';

const RenderConfig = () => (
    <Container className='d-flex column editor-render-options-container y-auto p-1-5'>
        <LightsControls />
        <EffectsControls />
        <PerformanceSettingsControls />
        <EnvironmentControls />
        <CameraSettingsControls />
        <OrbitControls />
        <RendererSettingsControls />
        <CanvasGridControls />
    </Container>
);

const EditorSidebar = () => {
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const activeSidebarTab = useEditorStore((state) => state.configuration.activeSidebarTab);
    const setActiveSidebarTab = useEditorStore((state) => state.configuration.setActiveSidebarTag);
    const showRenderConfig = useCanvasUIStore((state) => state.showRenderConfig);
    const setShowRenderConfig = useCanvasUIStore((state) => state.setShowRenderConfig);

    const SceneTab = () => (
        <CanvasSidebarScene trajectory={trajectory} trajectoryId={trajectory?._id} />
    );

    const ModifiersTab = () => <CanvasSidebarModifiers />;

    const tags = [
        { id: 'Scene', name: 'Scene', Component: SceneTab },
        { id: 'Modifiers', name: 'Modifiers', Component: ModifiersTab }
    ];

    return (
        <Sidebar
            tags={tags}
            activeTag={activeSidebarTab}
            onTagChange={setActiveSidebarTab}
            overrideContent={showRenderConfig ? <RenderConfig /> : null}
        >
            <Sidebar.Header>
                <Container className='d-flex column gap-1 sm:gap-0'>
                    <Container className='d-flex content-between items-center'>
                        <Container className='d-flex gap-1 items-center'>
                            {showRenderConfig ? (
                                <Container className='d-flex items-center gap-05'>
                                    <i onClick={() => setShowRenderConfig(false)}>
                                        <BsArrowLeft size={30} />
                                    </i>

                                    <Title>Render Settings</Title>
                                </Container>
                            ) : (
                                <>
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
                                </>
                            )}
                        </Container>
                    </Container>
                </Container>

                {!showRenderConfig && trajectory?.team && typeof trajectory.team !== 'string' && (
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

export default EditorSidebar;
