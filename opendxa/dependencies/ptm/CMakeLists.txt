ADD_LIBRARY(PolyhedralTemplateMatching
    ptm_alloy_types.cpp
    ptm_canonical_coloured.cpp
    ptm_convex_hull_incremental.cpp
    ptm_correspondences.cpp
    ptm_deformation_gradient.cpp
    ptm_graph_data.cpp
    ptm_graph_tools.cpp
    ptm_index.cpp
    ptm_initialize_data.cpp
    ptm_map_templates.cpp
    ptm_multishell.cpp
    ptm_neighbour_ordering.cpp
    ptm_normalize_vertices.cpp
    ptm_polar.cpp
    ptm_quat.cpp
    ptm_solid_angles.cpp
    ptm_structure_matcher.cpp
    ptm_voronoi_cell.cpp
)

# Set position independent code for Python extension
set_target_properties(PolyhedralTemplateMatching PROPERTIES POSITION_INDEPENDENT_CODE ON)