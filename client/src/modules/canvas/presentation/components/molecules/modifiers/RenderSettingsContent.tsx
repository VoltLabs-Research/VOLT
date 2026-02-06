import Container from '@/shared/presentation/components/Container';
import LightsControls from '@/modules/canvas/presentation/components/molecules/LightsControls';
import EffectsControls from '@/modules/canvas/presentation/components/molecules/EffectsControls';
import PerformanceSettingsControls from '@/modules/canvas/presentation/components/molecules/PerformanceSettingsControls';
import EnvironmentControls from '@/modules/canvas/presentation/components/molecules/EnvironmentControls';
import CameraSettingsControls from '@/modules/canvas/presentation/components/molecules/CameraSettingsControls';
import RendererSettingsControls from '@/modules/canvas/presentation/components/molecules/RendererSettingsControls';
import CanvasGridControls from '@/modules/canvas/presentation/components/molecules/CanvasGridControls';
import OrbitControls from '@/modules/canvas/presentation/components/molecules/OrbitControls';

interface RenderSettingsContentProps {
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
}

const RenderSettingsContent = (_props: RenderSettingsContentProps) => {
    return (
        <Container className='modifier-content-container p-1-5 render-settings-content'>
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
};

export default RenderSettingsContent;
