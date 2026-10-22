// The plugins voltlabs publishes to the registry, as their vpm.json files describe them.
const PACKAGES: [name: string, version: string, description: string][] = [
    ['ackland-jones', '1.0.6', 'Ackland-Jones bond-angle structure classifier: identifies FCC, HCP, BCC, ICO via adaptive nearest-neighbor bond angles. No cutoff parameter required (Ackland & Jones, PRB 2006).'],
    ['adaptive-common-neighbor-analysis', '2.0.5', 'Structural environment identification using Adaptive Common Neighbor Analysis (ACNA)'],
    ['atomic-strain', '2.0.4', 'Computes atomic strain metrics (deformation gradient, strain tensors, D²min, and polar decomposition R/U tensors) relative to a reference configuration.'],
    ['chill-plus', '1.0.6', 'Chill+ ice/hydrate structure classifier: identifies hexagonal ice, cubic ice, interfacial ice, hydrate and interfacial hydrate via spherical harmonic bond-order correlation (Nguyen & Molinero 2015).'],
    ['cluster-analysis', '2.0.4', 'Groups atoms into clusters using a distance cutoff and optionally computes the center of mass and radius of gyration.'],
    ['coordination-analysis', '2.0.5', 'Analyzes local atomic coordination by computing coordination numbers, the radial distribution function (RDF), and per-type-pair partial RDF histograms.'],
    ['displacements-analysis', '2.0.4', 'Calculates per-atom displacements relative to a reference configuration, accounting for periodic boundary conditions using the minimum image convention.'],
    ['elastic-strain', '2.0.6', 'Calculates per-atom elastic strain tensors using a reference crystal structure and lattice constant.'],
    ['generalized-template-matching', '1.0.0', 'Structure identification against an arbitrary reference crystal. Derives the point group with SOFI and the neighbor correspondence with CShDA, then exports the reconstructed-state contract for OpenDXA.'],
    ['grain-segmentation', '2.0.7', 'Identifies and segments crystalline grains based on local PTM orientations, merging grains with similar orientations.'],
    ['identify-diamond', '1.0.6', 'Identify cubic and hexagonal diamond structures using second-nearest-neighbor shell CNA. Labels core atoms and first/second neighbour shells.'],
    ['ilda', '1.0.5', 'Interfacial Line Defect Analysis (ILDA)'],
    ['kmeans-clustering', '1.0.2', 'Crystalline-structure and grain-boundary identification via K-means clustering of per-atom features (von Mises stress, potential energy, atomic volume), after Amigo et al. (2020). Groups atoms by cluster_id (FCC vs. grain boundary).'],
    ['multisom', '1.0.2', 'Unsupervised structure identification via a multilayer Self-Organizing Map. Consumes per-atom features produced by user-selected feature plugins (e.g. centrosymmetry-parameter, coordination-analysis) and groups atoms by cluster_id.'],
    ['opendxa', '2.4.4', 'Identifies and characterizes dislocations using the user-selected structure identification method.'],
    ['pattern-structure-matching', '2.0.7', 'Matches atomic structures against user-defined patterns and exports the reconstructed-state contract for OpenDXA.'],
    ['polyhedral-template-matching', '2.3.1', 'Identifies local crystal structures using PTM, exports per-atom structure types, and generates cluster graph artifacts for OpenDXA.'],
    ['reference-crystal-matching', '1.0.1', 'Registers an observed configuration against a perfect reference crystal of arbitrary composition/symmetry and emits the reconstructed-state contract (annotated dump + cluster tables + neighbor-lattice sidecar) for OpenDXA.'],
    ['voronoi-analysis', '1.0.8', 'Per-atom Voronoi tessellation: atomic volume, topological coordination number, max face order, and optional Voronoi index vector.'],
    ['wigner-seitz-defect-analysis', '1.0.6', 'Wigner-Seitz defect analysis: classifies reference lattice sites as vacancy/occupied/interstitial/antisite by occupancy against a current configuration.']
];

const PUBLISHER = 'voltlabs';

export const REGISTRY_PACKAGES = PACKAGES.map(([name, latest, description]) => ({
    fullName: `@${PUBLISHER}/${name}`,
    username: PUBLISHER,
    name,
    kind: 'workflow',
    description,
    latest
}));

export const REGISTRY_PACKAGE_COUNT = REGISTRY_PACKAGES.length;

// The one the marketplace opens on: dislocation analysis, OVITO's best known, as a plugin.
export const FEATURED_PACKAGE = `@${PUBLISHER}/opendxa`;

export const searchRegistry = (text: string) => {
    const query = text.trim().toLowerCase();
    return REGISTRY_PACKAGES.filter((item) => !query || `${item.name} ${item.description}`.toLowerCase().includes(query));
};
