import Sidebar from '@/shared/presentation/components/organisms/common/Sidebar';
import { useTrajectory } from '@/modules/trajectory/presentation/hooks/use-trajectory-queries';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import CanvasSidebarModifiers from '@/modules/canvas/presentation/components/molecules/CanvasSidebarModifiers';
import CanvasSidebarScene from '@/modules/canvas/presentation/components/molecules/CanvasSidebarScene';
import SidebarUserAvatar from '@/modules/auth/presentation/components/atoms/SidebarUserAvatar';
import { useUIStore } from '@/shared/presentation/stores/slices/ui';
import EditableTrajectoryName from '@/modules/trajectory/presentation/components/atoms/EditableTrajectoryName';
import { BsArrowLeft } from 'react-icons/bs';
import { MdKeyboardArrowDown } from 'react-icons/md';
import { useParams } from 'react-router';
import LightsControls from '@/modules/canvas/presentation/components/molecules/LightsControls';
import EffectsControls from '@/modules/canvas/presentation/components/molecules/EffectsControls';
import PerformanceSettingsControls from '@/modules/canvas/presentation/components/molecules/PerfomanceSettingsControls';
import EnvironmentControls from '@/modules/canvas/presentation/components/molecules/EnvironmentControls';
import CameraSettingsControls from '@/modules/canvas/presentation/components/molecules/CameraSettingsControls';
import RendererSettingsControls from '@/modules/canvas/presentation/components/molecules/RendererSettingsControls';
import CanvasGridControls from '@/modules/canvas/presentation/components/molecules/CanvasGridControls';
import OrbitControls from '@/modules/canvas/presentation/components/molecules/OrbitControls';
import Container from '@/shared/presentation/components/primitives/Container';
import '@/modules/canvas/presentation/components/organisms/EditorSidebar/EditorSidebar.css';
import Title from '@/shared/presentation/components/primitives/Title';
import Paragraph from '@/shared/presentation/components/primitives/Paragraph';

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
    const { trajectoryId } = useParams<{ trajectoryId: string }>();
    const { data: trajectory, isLoading } = useTrajectory(trajectoryId!, 'frames,team');
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

    if (isLoading) {
        return <Sidebar tags={SCENE_TAGS} activeTag={activeSidebarTab} showCollapseButton />
    }

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
                                        trajectory={trajectory!}
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
