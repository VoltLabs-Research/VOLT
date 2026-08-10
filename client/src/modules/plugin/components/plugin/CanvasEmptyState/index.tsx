import { NodeType } from '@volt/contracts/modules/plugin/enums';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { Button } from '@voltstack/bravais';
import { PlugZap, ArrowRight, ChevronRight } from 'lucide-react';

const WORKFLOW_STEPS = ['Modifier', 'Arguments', 'Context', 'ForEach', 'Entrypoint', 'Exposure'];

const CanvasEmptyState = () => {
    const addNode = usePluginBuilderStore((state) => state.addNode);

    return (
        <div className='flex absolute inset-0 z-10 items-center justify-center canvas-empty-state'>
            <div className='flex flex-col items-center gap-4 text-center canvas-empty-state-card bg-surface border border-border'>
                <div className='flex rounded-xl items-center justify-center canvas-empty-state-icon-wrapper'>
                    <PlugZap size={28} />
                </div>

                <div className='flex flex-col items-center gap-2'>
                    <h3 className='text-xl font-semibold text-foreground'>
                        Start building your plugin
                    </h3>
                    <p className='text-xs text-muted leading-normal canvas-empty-state-description'>
                        Drag nodes from the palette on the left, or add a Modifier node to get started with the plugin workflow.
                    </p>
                </div>

                <Button
                    intent='brand'
                    variant='solid'
                    size='sm'
                    rightIcon={<ArrowRight size={16} />}
                    onClick={() => addNode(NodeType.MODIFIER, {
                        x: 250,
                        y: 250
                    })}
                >
                    Add Modifier Node
                </Button>

                <div className='flex flex-row items-center justify-center flex-wrap gap-1 w-full canvas-empty-state-flow'>
                    {WORKFLOW_STEPS.map((step, i, arr) => (
                        <span className='flex flex-row items-center gap-1 text-muted text-xs' key={step}>
                            {step}
                            {i < arr.length - 1 && <ChevronRight size={10} />}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CanvasEmptyState;
