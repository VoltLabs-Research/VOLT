cmake_minimum_required(VERSION 3.20 FATAL_ERROR)

if(POLICY CMP0167)
    cmake_policy(SET CMP0167 NEW)
endif()

set(GEOGRAM_SUB_BUILD ON CACHE BOOL "")
set(GEOGRAM_LIB_ONLY ON CACHE BOOL "")   
set(GEOGRAM_WITH_GRAPHICS OFF CACHE BOOL "")

include(${CMAKE_SOURCE_DIR}/dependencies/geogram/cmake/geo_detect_platform.cmake)

project(OpenDXA VERSION 1.0.0 LANGUAGES CXX)

add_subdirectory(${CMAKE_SOURCE_DIR}/dependencies/json)
add_subdirectory(${CMAKE_SOURCE_DIR}/dependencies/geogram)

# Add local PTM dependency
add_subdirectory(${CMAKE_SOURCE_DIR}/dependencies/ptm)

find_program(CCACHE_PROGRAM ccache)
if(CCACHE_PROGRAM)
    message(STATUS "ccache: ${CCACHE_PROGRAM}")
    set(CMAKE_C_COMPILER_LAUNCHER ${CCACHE_PROGRAM})
    set(CMAKE_CXX_COMPILER_LAUNCHER ${CCACHE_PROGRAM})
endif()

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_BUILD_WITH_INSTALL_RPATH TRUE)
set(CMAKE_INSTALL_RPATH "$ORIGIN/lib")
set(CMAKE_CXX_EXTENSIONS OFF)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "Build all libs static" FORCE)

set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type")
set_property(CACHE CMAKE_BUILD_TYPE PROPERTY STRINGS
    Debug Release MinSizeRel RelWithDebInfo
)

include(CheckIPOSupported)
check_ipo_supported(RESULT LTO_SUPPORTED OUTPUT _)

if(LTO_SUPPORTED)
    set(CMAKE_INTERPROCEDURAL_OPTIMIZATION_RELEASE TRUE)
endif()

set(RELEASE_CXX_OPTS
    -O3
    -Ofast
    -march=native
    -flto=thin
    -funroll-loops
    -fstrict-aliasing
    -ffp-contract=off
    -fno-unsafe-math-optimizations
)

if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    set(LINKER_FAST "-fuse-ld=gold")
endif()

set(CMAKE_SKIP_BUILD_RPATH TRUE)
set(CMAKE_INSTALL_RPATH_USE_LINK_PATH TRUE)

include_directories(${CMAKE_SOURCE_DIR}/include)

find_package(Boost 1.88 REQUIRED)
find_package(Eigen3 REQUIRED)
find_package(Threads REQUIRED)
find_package(OpenMP REQUIRED)

message(STATUS "Eigen3: ${EIGEN3_INCLUDE_DIR}")
message(STATUS "Boost version: ${Boost_VERSION}")
message(STATUS "nlohmann_json disponible: ${nlohmann_json_SOURCE_DIR}")

# Source groups
set(CORE_SOURCES
    src/core/main.cpp
    src/core/property_base.cpp
    src/core/particle_property.cpp
    src/core/lammps_parser.cpp
    src/core/dislocation_analysis.cpp
    src/core/coordination_structures.cpp
)
set(STRUCTURES_SOURCES
    src/structures/cluster_graph.cpp
    src/structures/dislocation_network.cpp
)
set(ANALYSIS_SOURCES
    src/analysis/nearest_neighbor_finder.cpp
    src/analysis/crystal_path_finder.cpp
    src/analysis/dislocation_tracer.cpp
    src/analysis/elastic_mapping.cpp
    src/analysis/smooth_dislocations_modifier.cpp
    src/analysis/structure_analysis.cpp
    src/analysis/common_neighbor_analysis.cpp
)
set(GEOMETRY_SOURCES
    src/geometry/interface_mesh.cpp
    src/geometry/delaunay_tessellation.cpp
    src/geometry/tri_mesh.cpp
)
set(MATH_SOURCES
    src/math/affine_decomposition.cpp
)
set(UTILITIES_SOURCES
    src/utilities/json_exporter.cpp
)

set(LIBRARY_SOURCES
    ${CORE_SOURCES}
    ${STRUCTURES_SOURCES}
    ${ANALYSIS_SOURCES}
    ${GEOMETRY_SOURCES}
    ${MATH_SOURCES}
    ${UTILITIES_SOURCES}
)
list(REMOVE_ITEM LIBRARY_SOURCES src/core/main.cpp)

# Library
add_library(opendxa_lib STATIC ${LIBRARY_SOURCES})
set_target_properties(opendxa_lib PROPERTIES
    POSITION_INDEPENDENT_CODE ON
    INTERPROCEDURAL_OPTIMIZATION TRUE
    LINK_FLAGS_RELEASE "${LINKER_FAST}"
)
target_compile_options(opendxa_lib PRIVATE
    $<$<CONFIG:Release>:${RELEASE_CXX_OPTS}>
)
target_compile_definitions(opendxa_lib PRIVATE
    $<$<CONFIG:Release>:NDEBUG>
)

target_include_directories(opendxa_lib PUBLIC
    ${CMAKE_SOURCE_DIR}/include
    ${EIGEN3_INCLUDE_DIR}
    ${CMAKE_SOURCE_DIR}/dependencies/ptm/include
)

target_link_libraries(opendxa_lib PUBLIC
    Threads::Threads
    Boost::boost
    geogram
    PolyhedralTemplateMatching
    nlohmann_json::nlohmann_json
    OpenMP::OpenMP_CXX
)

# Executable
add_executable(opendxa src/core/main.cpp)
set_target_properties(opendxa PROPERTIES
    LINK_FLAGS_RELEASE "${LINKER_FAST}"
)
target_compile_options(opendxa PRIVATE
    $<$<CONFIG:Release>:${RELEASE_CXX_OPTS}>
)
target_compile_definitions(opendxa PRIVATE
    $<$<CONFIG:Release>:NDEBUG>
)
target_link_libraries(opendxa PRIVATE opendxa_lib)

# Installation
install(TARGETS opendxa DESTINATION bin)
install(TARGETS opendxa_lib DESTINATION lib)
install(DIRECTORY include/ DESTINATION include)
