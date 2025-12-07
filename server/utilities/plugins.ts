import { Analysis } from '@/models';
import ManifestService from '@/services/plugins/manifest-service';
import RuntimeError from '@/utilities/runtime/runtime-error';

export const getModifierPerAtomProps = async (analysisId: string): Promise<string[]> => {
    const props = [];

    const analysis = await Analysis.findById(analysisId);
    if(!analysis) throw new RuntimeError('Analysis::NotFound', 404);

    const manifest = await new ManifestService(analysis.plugin).get();
    const modifier = manifest.modifiers?.[analysis.modifier];

    if(!modifier) throw new RuntimeError('Analysis::Modifier::NotFound', 404);
    for(const [key, exposure] of Object.entries(modifier.exposure)){
        if(exposure.perAtomProperties && Array.isArray(exposure.perAtomProperties)){
            props.push(...exposure.perAtomProperties);
        }
    }

    return props;
};