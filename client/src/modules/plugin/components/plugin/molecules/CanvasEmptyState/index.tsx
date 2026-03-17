import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import { PlugZap, ArrowRight, ChevronRight } from 'lucide-react';
import { useCallback } from 'react';

const CanvasEmptyState = () => {
    const addNode = usePluginBuilderStore((state) => state.addNode);

    const handleAddModifier = useCallback(() => {
        addNode(NodeType.MODIFIER, { x: 250, y: 250 });
    }, [addNode]);

    return (
        <Container className='p-absolute inset-0 d-flex flex-center z-10 canvas-empty-state'>
            <Container className='d-flex column items-center gap-1 text-center canvas-empty-state-card glass-bg'>
                <Container className='d-flex flex-center radius-md canvas-empty-state-icon-wrapper'>
                    <PlugZap size={28} />
                </Container>

                <Container className='d-flex column gap-05 items-center'>
                    <Title className='font-size-4 font-weight-6'>
                        Start building your plugin
                    </Title>
                    <Paragraph className='color-secondary font-size-2 line-height-5 canvas-empty-state-description'>
                        Drag nodes from the palette on the left, or add a Modifier node to get started with the plugin workflow.
                    </Paragraph>
                </Container>

                <Button
                    intent='brand'
                    variant='solid'
                    size='sm'
                    rightIcon={<ArrowRight size={16} />}
                    onClick={handleAddModifier}
                >
                    Add Modifier Node
                </Button>

                <Container className='w-max d-flex items-center content-center flex-wrap gap-025 canvas-empty-state-flow'>
                    {['Modifier', 'Arguments', 'Context', 'ForEach', 'Entrypoint', 'Exposure'].map((step, i, arr) => (
                        <span key={step} className='d-flex items-center gap-025 color-muted font-size-1'>
                            {step}
                            {i < arr.length - 1 && <ChevronRight size={10} />}
                        </span>
                    ))}
                </Container>
            </Container>
        </Container>
    );
};

export default CanvasEmptyState;
