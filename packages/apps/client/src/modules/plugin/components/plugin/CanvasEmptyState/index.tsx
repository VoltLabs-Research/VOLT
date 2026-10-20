import { NodeType } from '@volt/contracts/modules/plugin/enums';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { Button } from '@heroui/react';
import { PlugZap, ArrowRight, ChevronRight } from 'lucide-react';

const WORKFLOW_STEPS = ['Modifier', 'Arguments', 'Context', 'ForEach', 'Entrypoint', 'Exposure'];

const CanvasEmptyState = () => {
    const addNode = usePluginBuilderStore((state) => state.addNode);

    return (
        <div className='absolute inset-0 z-10 flex flex-row items-center justify-center pointer-events-none'>
            <div className='pointer-events-auto flex max-w-[420px] flex-col items-center gap-4 border border-border bg-surface px-12 py-10 text-center max-[768px]:max-w-[calc(100vw-2rem)] max-[768px]:px-5 max-[768px]:py-6'>
                <div className='flex size-14 flex-row items-center justify-center rounded-xl bg-info-soft text-accent'>
                    <PlugZap size={28} aria-hidden='true' />
                </div>
                <div className='flex flex-col items-center gap-2'>
                    <h3 className='text-xl font-semibold text-foreground'>
                        Start building your plugin
                    </h3>
                    <p className='max-w-[320px] text-xs leading-normal text-muted'>
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
                <div className='flex w-full flex-row flex-wrap items-center justify-center gap-1 border-t border-border pt-3'>
                    {WORKFLOW_STEPS.map((step, i, arr) => (
                        <span className='flex flex-row items-center gap-1 text-xs text-muted' key={step}>
                            {step}
                            {i < arr.length - 1 && <ChevronRight size={10} aria-hidden='true' />}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CanvasEmptyState;
