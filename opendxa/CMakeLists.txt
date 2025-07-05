cmake_minimum_required(VERSION 3.20 FATAL_ERROR)

# Set policy for Boost module
if(POLICY CMP0167)
    cmake_policy(SET CMP0167 NEW)
endif()

project(OpenDXA VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

message(STATUS "Using C++${CMAKE_CXX_STANDARD} standard")

set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type")
set_property(CACHE CMAKE_BUILD_TYPE PROPERTY STRINGS "Debug" "Release" "MinSizeRel" "RelWithDebInfo")

# Minimal optimization flags for numerical accuracy
if(CMAKE_CXX_COMPILER_ID STREQUAL "GNU")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fconcepts -fPIC")
    set(CMAKE_CXX_FLAGS_DEBUG "-g -O0 -Wall -Wextra -fPIC")
    # Minimal optimization - only basic -O1 to maintain precision
    set(CMAKE_CXX_FLAGS_RELEASE "-O1 -DNDEBUG -fPIC")
elseif(CMAKE_CXX_COMPILER_ID STREQUAL "Clang")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fconcepts -fPIC")
    set(CMAKE_CXX_FLAGS_DEBUG "-g -O0 -Wall -Wextra -fPIC")
    # Minimal optimization - only basic -O1 to maintain precision
    set(CMAKE_CXX_FLAGS_RELEASE "-O1 -DNDEBUG -fPIC")
endif()

# Enable Link Time Optimization for maximum performance
if(CMAKE_BUILD_TYPE STREQUAL "Release")
    # Disable LTO to avoid numerical precision issues
    set(CMAKE_INTERPROCEDURAL_OPTIMIZATION FALSE)
endif()

# Options
option(BUILD_TESTS "Build tests" OFF)
option(BUILD_DOCS "Build documentation" OFF)

if(BUILD_TESTS)
    enable_testing()
endif()

include_directories(${CMAKE_SOURCE_DIR}/include)

find_package(Boost 1.88 REQUIRED)
find_package(Eigen3 REQUIRED)
find_package(Threads REQUIRED)
find_package(OpenMP REQUIRED)

find_package(nlohmann_json QUIET)
if(NOT nlohmann_json_FOUND)
    include(FetchContent)
    FetchContent_Declare(
        nlohmann_json
        GIT_REPOSITORY https://github.com/nlohmann/json.git
        GIT_TAG v3.11.3
    )
    FetchContent_MakeAvailable(nlohmann_json)
endif()

message(STATUS "Found Eigen3: ${EIGEN3_INCLUDE_DIR}")
message(STATUS "Found Boost version: ${Boost_VERSION}")
message(STATUS "nlohmann_json available")

include_directories(${EIGEN3_INCLUDE_DIR})

# Source files organized by module
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

# Combine all sources except Main.cpp for library
set(LIBRARY_SOURCES
    ${CORE_SOURCES}
    ${STRUCTURES_SOURCES}
    ${ANALYSIS_SOURCES}
    ${GEOMETRY_SOURCES}
    ${MATH_SOURCES}
    ${UTILITIES_SOURCES}
)
list(REMOVE_ITEM LIBRARY_SOURCES src/core/main.cpp)

# Add dependencies subdirectory
add_subdirectory(dependencies)

# Create static library with optimizations
add_library(CrystalAnalysis STATIC ${LIBRARY_SOURCES})

# No additional compile options - keep it simple for accuracy
target_compile_options(CrystalAnalysis PRIVATE
    # No optimization flags
)

target_compile_definitions(CrystalAnalysis PRIVATE
    # Minimal definitions for release
    $<$<CONFIG:Release>:NDEBUG>
)

target_include_directories(CrystalAnalysis PUBLIC 
    ${CMAKE_SOURCE_DIR}/include
    ${CMAKE_SOURCE_DIR}/dependencies
    ${CMAKE_SOURCE_DIR}/dependencies/geogram
    ${CMAKE_SOURCE_DIR}/dependencies/ptm
    ${EIGEN3_INCLUDE_DIR}
)

# Link dependencies to library
target_link_libraries(CrystalAnalysis
    PUBLIC
    Threads::Threads
    ${Boost_LIBRARIES}
    geogram
    PolyhedralTemplateMatching
    nlohmann_json::nlohmann_json
    OpenMP::OpenMP_CXX
)

# Create executable with optimizations
add_executable(opendxa src/core/main.cpp)

# No additional compile options - keep it simple for accuracy
target_compile_options(opendxa PRIVATE
    # No optimization flags
)

target_compile_definitions(opendxa PRIVATE
    # Minimal definitions for release
    $<$<CONFIG:Release>:NDEBUG>
)

target_include_directories(opendxa PRIVATE
    ${CMAKE_SOURCE_DIR}/include
    ${CMAKE_SOURCE_DIR}/dependencies
    ${CMAKE_SOURCE_DIR}/dependencies/geogram
    ${CMAKE_SOURCE_DIR}/dependencies/ptm
    ${EIGEN3_INCLUDE_DIR}
)
target_link_libraries(opendxa 
    PRIVATE 
    CrystalAnalysis
)

# Installation
install(TARGETS opendxa DESTINATION bin)
install(TARGETS CrystalAnalysis DESTINATION lib)
install(DIRECTORY include/ DESTINATION include)