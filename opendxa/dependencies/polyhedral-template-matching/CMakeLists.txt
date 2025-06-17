cmake_minimum_required(VERSION 3.12)

# Build library.
ADD_LIBRARY(ptm
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

SET_TARGET_PROPERTIES(ptm PROPERTIES CXX_VISIBILITY_PRESET "default")
SET_TARGET_PROPERTIES(ptm PROPERTIES OUTPUT_NAME "opendxa")
SET_TARGET_PROPERTIES(ptm PROPERTIES UNITY_BUILD OFF)
TARGET_LINK_LIBRARIES(ptm PRIVATE VoroPlusPlus)
TARGET_INCLUDE_DIRECTORIES(ptm INTERFACE "${CMAKE_CURRENT_SOURCE_DIR}/..")