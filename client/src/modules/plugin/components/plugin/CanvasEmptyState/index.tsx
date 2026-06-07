import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { Box, Button, Heading, Row, Stack, Text } from '@voltstack/bravais';
import { PlugZap, ArrowRight, ChevronRight } from 'lucide-react';
import { useCallback } from 'react';

const CanvasEmptyState = () => {
    const addNode = usePluginBuilderStore((state) => state.addNode);

    const handleAddModifier = useCallback(() => {
        addNode(NodeType.MODIFIER, { x: 250, y: 250 });
    }, [addNode]);

    return (
        <Box position='absolute' inset='0' display='flex' zIndex='10' className='flex-center canvas-empty-state'>
            <Stack align='center' gap='1' textAlign='center' className='canvas-empty-state-card glass-bg'>
                <Box display='flex' radius='md' className='flex-center canvas-empty-state-icon-wrapper'>
                    <PlugZap size={28} />
                </Box>

                <Stack gap='05' align='center'>
                    <Heading level={3} size='xl' weight='bold'>
                        Start building your plugin
                    </Heading>
                    <Text as='p' size='sm' tone='muted' lineHeight='5' className='canvas-empty-state-description'>
                        Drag nodes from the palette on the left, or add a Modifier node to get started with the plugin workflow.
                    </Text>
                </Stack>

                <Button
                    intent='brand'
                    variant='solid'
                    size='sm'
                    rightIcon={<ArrowRight size={16} />}
                    onClick={handleAddModifier}
                >
                    Add Modifier Node
                </Button>

                <Row wrap justify='center' gap='025' width='max' className='canvas-empty-state-flow'>
                    {['Modifier', 'Arguments', 'Context', 'ForEach', 'Entrypoint', 'Exposure'].map((step, i, arr) => (
                        <Row as='span' key={step} gap='025' className='color-muted font-size-1'>
                            {step}
                            {i < arr.length - 1 && <ChevronRight size={10} />}
                        </Row>
                    ))}
                </Row>
            </Stack>
        </Box>
    );
};

export default CanvasEmptyState;
