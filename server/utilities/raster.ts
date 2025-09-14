export const parseFrame = (name: string): number | null => {
    const withoutExt = name.replace(/\.(png|glb)$/i, '');
    const m1 = withoutExt.match(/frame[-_](\d+)(?:[_-]|$)/i);
    if(m1) return parseInt(m1[1], 10);
    const m2 = withoutExt.match(/^(\d+)$/);
    if(m2) return parseInt(m2[1], 10);
    return null;
};

export const parseType = (name: string) => {
    const s = name.toLowerCase();
    if(s.includes('atoms_colored_by_type')) return 'atoms_colored_by_type' as const;
    if(s.includes('dislocations')) return 'dislocations' as const;
    if(s.includes('interface_mesh')) return 'interface_mesh' as const;
    if(s.includes('defect_mesh')) return 'defect_mesh' as const;
    return null;
};

export const typeOrder: Record<string, number> = {
    defect_mesh: 0,
    interface_mesh: 1,
    dislocations: 2,
    atoms_colored_by_type: 3
};

export const resolvePngForGlb = (
  glbName: string,
  frame: number | null,
  pngSet: Set<string>
): string | null => {
    if(!frame) return null;
    const primary = glbName.replace(/\.glb$/i, '.png');
    if(pngSet.has(primary.toLowerCase())) return primary;

    const candidate = `frame-${frame}.png`;
    if(pngSet.has(candidate)){
        return candidate;
    }

    return null;
};
