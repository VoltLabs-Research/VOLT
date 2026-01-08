import Sidebar from '@/components/organisms/common/Sidebar';
import { useTrajectoryStore } from '@/stores/slices/trajectory';
import { useEditorStore } from '@/stores/slices/editor';
import CanvasSidebarModifiers from '@/components/molecules/scene/CanvasSidebarModifiers';
import CanvasSidebarScene from '@/components/molecules/scene/CanvasSidebarScene';
import SidebarUserAvatar from '@/components/atoms/auth/SidebarUserAvatar';
import { useUIStore } from '@/stores/slices/ui';
import EditableTrajectoryName from '@/components/atoms/trajectory/EditableTrajectoryName';
import { BsArrowLeft } from 'react-icons/bs';
import { MdKeyboardArrowDown } from 'react-icons/md';
import LightsControls from '@/components/molecules/scene/LightsControls';
import EffectsControls from '@/components/molecules/scene/EffectsControls';
import PerformanceSettingsControls from '@/components/molecules/scene/PerfomanceSettingsControls';
import EnvironmentControls from '@/components/molecules/scene/EnvironmentControls';
import CameraSettingsControls from '@/components/molecules/scene/CameraSettingsControls';
import RendererSettingsControls from '@/components/molecules/scene/RendererSettingsControls';
import CanvasGridControls from '@/components/molecules/scene/CanvasGridControls';
import OrbitControls from '@/components/molecules/scene/OrbitControls';
import Container from '@/components/primitives/Container';
import './EditorSidebar.css';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';

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
    const showRenderConfig = useUIStore((state) => state.showRenderConfig);
    const setShowRenderConfig = useUIStore((state) => state.setShowRenderConfig);

    const SCENE_TAGS = [{
        id: "Scene",
        name: "Scene",
        Component: CanvasSidebarScene,
        props: { trajectory }
    }, {
        id: "Modifiers",
        name: "Modifiers",
        Component: CanvasSidebarModifiers,
        props: {}
    }] as any;

    return (
        <Sidebar
            tags={SCENE_TAGS}
            activeTag={activeSidebarTab}
            overrideContent={showRenderConfig ? <RenderConfig /> : null}
            showCollapseButton
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
                                    <EditableTrajectoryName
                                        trajectory={trajectory}
                                        className='editor-sidebar-trajectory-name'
                                    />

                                    <i className='editor-sidebar-trajectory-drop-icon-container'>
                                        <MdKeyboardArrowDown />
                                    </i>
                                </>
                            )}
                        </Container>
                    </Container>
                </Container>

                {!showRenderConfig && trajectory?.team && typeof trajectory.team !== 'string' && (
                    <Paragraph className="editor-sidebar-header-team-name">
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

