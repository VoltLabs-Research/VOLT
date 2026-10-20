import { pruneExpandedTimesteps } from './artifact-labels';

import { Filter, Palette } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { ComponentType, CSSProperties } from 'react';
import type { SceneArtifact, SceneArtifactSourceType } from '@volt/contracts/modules/trajectory/domain';

export const TIMESTEP_PAGE_SIZE = 50;

type ArtifactSectionId = Exclude<SceneArtifactSourceType, 'plugin-exposure'>;

type SectionRecord<T> = Record<ArtifactSectionId, T>;

interface ArtifactSectionDefinition {
    id: ArtifactSectionId;
    title: string;
    ariaLabel: string;
    icon: ComponentType<{ style?: CSSProperties }>;
}

export interface ArtifactSection extends ArtifactSectionDefinition {
    timesteps: number[];
    artifactsByTimestep: Map<number, SceneArtifact[]>;
    expandedTimesteps: Set<number>;
    toggleTimestep: (timestep: number) => void;
    visibleCount: number;
    showMoreTimesteps: () => void;
    open: boolean;
    setOpen: (open: boolean) => void;
}

const SECTION_DEFINITIONS: ArtifactSectionDefinition[] = [
    {
        id: 'color-coding',
        title: 'Color Coding',
        ariaLabel: 'Color Coding hierarchy',
        icon: Palette
    },
    {
        id: 'particle-filter',
        title: 'Particle Filter',
        ariaLabel: 'Particle Filter hierarchy',
        icon: Filter
    },
];

const ALL_CLOSED: SectionRecord<boolean> = {
    'color-coding': false,
    'particle-filter': false
};

const FIRST_PAGE: SectionRecord<number> = {
    'color-coding': TIMESTEP_PAGE_SIZE,
    'particle-filter': TIMESTEP_PAGE_SIZE
};

const createEmptyExpanded = (): SectionRecord<Set<number>> => ({
    'color-coding': new Set(),
    'particle-filter': new Set()
});

const withSectionValue = <T>(current: SectionRecord<T>, id: ArtifactSectionId, value: T): SectionRecord<T> => {
    const next = { ...current };
    next[id] = value;
    return next;
};

const useTimestepIndex = (artifacts: SceneArtifact[]) => useMemo(() => {
    const artifactsByTimestep = new Map<number, SceneArtifact[]>();

    for (const artifact of artifacts) {
        const group = artifactsByTimestep.get(artifact.timestep);
        if (group) group.push(artifact);
        else artifactsByTimestep.set(artifact.timestep, [artifact]);
    }

    return {
        artifactsByTimestep,
        timesteps: [...artifactsByTimestep.keys()].sort((left, right) => right - left)
    };
}, [artifacts]);

const useArtifactSections = (artifacts: SectionRecord<SceneArtifact[]>): ArtifactSection[] => {
    const [openById, setOpenById] = useState(ALL_CLOSED);
    const [visibleCountById, setVisibleCountById] = useState(FIRST_PAGE);
    const [expandedById, setExpandedById] = useState(createEmptyExpanded);

    const colorCoding = useTimestepIndex(artifacts['color-coding']);
    const particleFilter = useTimestepIndex(artifacts['particle-filter']);

    const indexById: SectionRecord<ReturnType<typeof useTimestepIndex>> = useMemo(() => ({
        'color-coding': colorCoding,
        'particle-filter': particleFilter
    }), [colorCoding, particleFilter]);

    useEffect(() => {
        setExpandedById((current) => {
            let changed = false;
            const next = { ...current };

            for (const { id } of SECTION_DEFINITIONS) {
                next[id] = pruneExpandedTimesteps(current[id], indexById[id].timesteps);
                changed = changed || next[id] !== current[id];
            }

            return changed ? next : current;
        });
    }, [indexById]);

    useEffect(() => {
        const onArtifactsChanged = (event: Event) => {
            const { source, timestep } = (event as CustomEvent<{ source?: ArtifactSectionId; timestep?: number }>).detail ?? {};
            if (!source || timestep === undefined) return;

            setOpenById((current) => withSectionValue(current, source, true));
            setExpandedById((current) => withSectionValue(current, source, new Set(current[source]).add(timestep)));
        };

        window.addEventListener('canvas:scene-artifacts:changed', onArtifactsChanged);
        return () => {
            window.removeEventListener('canvas:scene-artifacts:changed', onArtifactsChanged);
        };
    }, []);

    return SECTION_DEFINITIONS.map((definition) => ({
        ...definition,
        ...indexById[definition.id],
        expandedTimesteps: expandedById[definition.id],
        visibleCount: visibleCountById[definition.id],
        open: openById[definition.id],
        setOpen: (open: boolean) => {
            setOpenById((current) => withSectionValue(current, definition.id, open));
        },
        showMoreTimesteps: () => {
            setVisibleCountById((current) => withSectionValue(current, definition.id, current[definition.id] + TIMESTEP_PAGE_SIZE));
        },
        toggleTimestep: (timestep: number) => {
            setExpandedById((current) => {
                const expanded = new Set(current[definition.id]);
                if (!expanded.delete(timestep)) expanded.add(timestep);
                return withSectionValue(current, definition.id, expanded);
            });
        }
    }));
};

export default useArtifactSections;
