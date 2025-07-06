cmake_minimum_required(VERSION 3.20 FATAL_ERROR)

if(POLICY CMP0167)
    cmake_policy(SET CMP0167 NEW)
endif()

project(OpenDXA VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_POSITION_INDEPENDENT_CODE ON CACHE BOOL "" FORCE)

# TODO: When I compile from the bash script, for some reason 
# (perhaps also the setup.py build), it causes numerical inconsistencies. 
# I spent HOURS trying to figure out why and changing things in the code, 
# only to realize by chance that when I compiled without building the 
# library in pip, it worked fine.

add_subdirectory(${CMAKE_SOURCE_DIR}/dependencies/json)
add_subdirectory(${CMAKE_SOURCE_DIR}/dependencies/geogram)

# Add local PTM dependency
add_subdirectory(${CMAKE_SOURCE_DIR}/dependencies/ptm)
set(BUILD_SHARED_LIBS ON CACHE BOOL "Build shared libraries" FORCE)

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

set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type")
set_property(CACHE CMAKE_BUILD_TYPE PROPERTY STRINGS
    Debug Release MinSizeRel RelWithDebInfo
)

include(CheckIPOSupported)
check_ipo_supported(RESULT LTO_SUPPORTED OUTPUT _)

if(LTO_SUPPORTED)
    set(CMAKE_INTERPROCEDURAL_OPTIMIZATION_RELEASE TRUE)
endif()

include(CheckCXXCompilerFlag)
check_cxx_compiler_flag("-flto=thin" HAS_THIN_LTO)
if(HAS_THIN_LTO)
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -flto=thin")
else()
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -flto")
endif()

set(RELEASE_CXX_OPTS
    -O3
    -march=native
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
find_package(TBB REQUIRED)

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
add_library(opendxa_lib SHARED ${LIBRARY_SOURCES}) 
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
    ${CMAKE_SOURCE_DIR}/dependencies/geogram
    ${EIGEN3_INCLUDE_DIR}
    ${CMAKE_SOURCE_DIR}/dependencies/ptm/include
)

target_link_libraries(opendxa_lib PUBLIC
    geogram
    PolyhedralTemplateMatching
    nlohmann_json::nlohmann_json
    Threads::Threads
    Boost::boost
    OpenMP::OpenMP_CXX
    TBB::tbb
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
