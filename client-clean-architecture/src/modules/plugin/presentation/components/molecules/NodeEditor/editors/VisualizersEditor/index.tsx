import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormField from '@/shared/presentation/components/FormField';
import { useNodeForm } from '@/modules/plugin/presentation/hooks';
import type { IVisualizersData } from '@/modules/plugin/domain/entities';

interface VisualizersEditorProps {
    node: Node;
};

const DEFAULT_VISUALIZERS: IVisualizersData = {
    canvas: false,
    raster: false,
    listing: {},
    perAtomProperties: []
};

const VisualizersEditor = ({ node }: VisualizersEditorProps) => {
    const { field } = useNodeForm(node, 'visualizers', DEFAULT_VISUALIZERS);

    return (
        <>
            <CollapsibleSection title='Visualization Options' defaultExpanded>
                <FormField
                    variant='inline'
                    label='Enable Canvas (3D Viewer)'
                    fieldType='checkbox'
                    {...field('canvas')}
                />
                <FormField
                    variant='inline'
                    label='Enable Raster (2D Images)'
                    fieldType='checkbox'
                    {...field('raster')}
                />
            </CollapsibleSection>

            <CollapsibleSection title='Listing Title'>
                <FormField
                    variant='inline'
                    label='Title'
                    fieldType='input'
                    {...field('listingTitle')}
                    placeholder='Results Table'
                />
            </CollapsibleSection>
        </>
    );
};

export default VisualizersEditor;
