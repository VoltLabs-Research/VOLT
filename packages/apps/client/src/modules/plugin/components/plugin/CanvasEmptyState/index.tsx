import { NodeType } from '@volt/contracts/modules/plugin/enums';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { Button } from '@heroui/react';
import { ArrowRight } from 'lucide-react';

const WORKFLOW_STEPS = ['Modifier', 'Arguments', 'Context', 'ForEach', 'Entrypoint', 'Exposure'];

const CanvasEmptyState = () => {
    const addNode = usePluginBuilderStore((state) => state.addNode);

    return (
        <div className='absolute inset-0 z-10 flex flex-row items-center justify-center pointer-events-none max-[768px]:pr-2 max-[768px]:pl-18'>
            <div className='glass-surface pointer-events-auto flex w-[420px] max-w-full flex-col items-center gap-4 rounded-3xl bg-overlay px-8 pt-10 pb-7 text-center shadow-[var(--overlay-shadow)] max-[768px]:px-5 max-[768px]:pt-7 max-[768px]:pb-5'>
                <div className='flex flex-col items-center gap-2'>
                    <h3 className='text-xl font-semibold text-balance text-foreground'>
                        Start building your plugin
                    </h3>
                    <p className='max-w-80 text-sm leading-normal text-muted'>
                        Drag nodes from the palette on the left, or add a Modifier node to get started with the plugin workflow.
                    </p>
                </div>
                <Button
                    variant='primary'
                    size='sm'
                    onPress={() => addNode(NodeType.MODIFIER, {
                        x: 250,
                        y: 250
                    })}
                >
                    Add Modifier Node
                    <ArrowRight size={16} aria-hidden='true' />
                </Button>
                <p className='w-full border-t border-separator pt-3.5 text-xs text-muted'>
                    {WORKFLOW_STEPS.join(' › ')}
                </p>
            </div>
        </div>
    );
};

export default CanvasEmptyState;
