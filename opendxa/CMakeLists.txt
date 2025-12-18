cmake_minimum_required(VERSION 3.20 FATAL_ERROR)

project(OpenDXA VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(CMAKE_POSITION_INDEPENDENT_CODE ON)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

find_program(CCACHE_PROGRAM ccache)
if(CCACHE_PROGRAM)
    set(CMAKE_C_COMPILER_LAUNCHER ${CCACHE_PROGRAM})
    set(CMAKE_CXX_COMPILER_LAUNCHER ${CCACHE_PROGRAM})
endif()

add_subdirectory(dependencies/json)
add_subdirectory(dependencies/geogram)
add_subdirectory(dependencies/ptm)

find_package(Threads REQUIRED)
find_package(OpenMP REQUIRED)
find_package(TBB REQUIRED)
find_package(spdlog REQUIRED)

include(CheckIPOSupported)
check_ipo_supported(RESULT IPO_SUPPORTED)
if(IPO_SUPPORTED)
    set(CMAKE_INTERPROCEDURAL_OPTIMIZATION_RELEASE ON)
endif()

# =========================
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    add_link_options(-fuse-ld=lld)
endif()

set(OPENDXA_RELEASE_FLAGS
    -O3
    -march=native
    -mtune=native
    -ffast-math
    -fno-math-errno
    -fomit-frame-pointer
)

set(LIBRARY_SOURCES
    src/core/property_base.cpp
    src/core/particle_property.cpp
    src/core/lammps_parser.cpp
    src/core/dislocation_analysis.cpp
    src/core/coordination_structures.cpp
    src/analysis/atomic_strain.cpp
    src/analysis/ptm_neighbor_finder.cpp
    src/structures/cluster_graph.cpp
    src/structures/dislocation_network.cpp
    src/analysis/delaunay_tessellation_spatial_query.cpp
    src/analysis/nearest_neighbor_finder.cpp
    src/analysis/crystal_path_finder.cpp
    src/analysis/cluster_connector.cpp
    src/analysis/elastic_strain.cpp
    src/analysis/burgers_loop_builder.cpp
    src/analysis/analysis_context.cpp
    src/analysis/cutoff_neighbor_finder.cpp
    src/analysis/polyhedral_template_matching.cpp
    src/analysis/coordination_analysis.cpp
    src/analysis/elastic_mapping.cpp
    src/analysis/structure_analysis.cpp
    src/analysis/common_neighbor_analysis.cpp
    src/geometry/interface_mesh.cpp
    src/geometry/delaunay_tessellation.cpp
    src/math/affine_decomposition.cpp
    src/utilities/json_exporter.cpp
    src/utilities/msgpack_writer.cpp
)

add_library(opendxa_lib STATIC ${LIBRARY_SOURCES})

target_compile_options(opendxa_lib PRIVATE
    $<$<CONFIG:Release>:${OPENDXA_RELEASE_FLAGS}>
)

target_compile_definitions(opendxa_lib PRIVATE
    $<$<CONFIG:Release>:NDEBUG>
)

target_include_directories(opendxa_lib PUBLIC
    include
    dependencies/geogram
    dependencies/ptm
)

target_link_libraries(opendxa_lib PUBLIC
    geogram
    PolyhedralTemplateMatching
    nlohmann_json::nlohmann_json
    Threads::Threads
    TBB::tbb
    OpenMP::OpenMP_CXX
    spdlog::spdlog
)

function(add_opendxa_tool name source)
    add_executable(${name} ${source})
    target_compile_options(${name} PRIVATE
        $<$<CONFIG:Release>:${OPENDXA_RELEASE_FLAGS}>
    )
    target_compile_definitions(${name} PRIVATE
        $<$<CONFIG:Release>:NDEBUG>
    )
    target_link_libraries(${name} PRIVATE
        opendxa_lib
        OpenMP::OpenMP_CXX
        spdlog::spdlog
    )
endfunction()

add_opendxa_tool(opendxa src/functions/dxa.cpp)
add_opendxa_tool(structure-identification src/functions/structure.cpp)
add_opendxa_tool(atomic-strain src/functions/atomic_strain.cpp)
add_opendxa_tool(elastic-strain src/functions/elastic_strain.cpp)
add_opendxa_tool(coordination-analysis src/functions/coordination.cpp)
add_opendxa_tool(grain-segmentation src/functions/grains.cpp)
