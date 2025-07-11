cmake_minimum_required(VERSION 3.20 FATAL_ERROR)

project(OpenDXA VERSION 1.0.0 LANGUAGES CXX)

# Force PIC globally so that static libs can be linked into .so
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Internal dependencies
add_subdirectory(${CMAKE_SOURCE_DIR}/dependencies/json)
add_subdirectory(${CMAKE_SOURCE_DIR}/dependencies/geogram)
add_subdirectory(${CMAKE_SOURCE_DIR}/dependencies/ptm)

# ccache
find_program(CCACHE_PROGRAM ccache)
if(CCACHE_PROGRAM)
    message(STATUS "ccache: ${CCACHE_PROGRAM}")
    set(CMAKE_C_COMPILER_LAUNCHER ${CCACHE_PROGRAM})
    set(CMAKE_CXX_COMPILER_LAUNCHER ${CCACHE_PROGRAM})
endif()

# C++ standard & RPATH
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(CMAKE_BUILD_WITH_INSTALL_RPATH TRUE)
set(CMAKE_INSTALL_RPATH "$ORIGIN/lib")
set(CMAKE_SKIP_BUILD_RPATH TRUE)
set(CMAKE_INSTALL_RPATH_USE_LINK_PATH TRUE)

# Build type & optimization
set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type")
set_property(CACHE CMAKE_BUILD_TYPE PROPERTY STRINGS Debug Release MinSizeRel RelWithDebInfo)

# IPO / LTO
include(CheckIPOSupported)
check_ipo_supported(RESULT LTO_SUPPORTED OUTPUT _)
if(LTO_SUPPORTED)
    set(CMAKE_INTERPROCEDURAL_OPTIMIZATION_RELEASE TRUE)
endif()

include(CheckCXXCompilerFlag)
check_cxx_compiler_flag("-flto=thin" HAS_THIN_LTO)
if(HAS_THIN_LTO)
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -O3 -flto=thin")
else()
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -O3 -flto")
endif()

# Extra Release flags
set(RELEASE_CXX_OPTS
  -O3 -Ofast -march=native -funroll-loops
  -fstrict-aliasing -ffp-contract=off -fno-unsafe-math-optimizations
)

# Fast linker when using GNU/Clang
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    set(LINKER_FAST "-fuse-ld=gold")
endif()

# Force static libraries
set(BUILD_SHARED_LIBS OFF CACHE BOOL "Build all libs static" FORCE)

include_directories(${CMAKE_SOURCE_DIR}/include)

# External packages
find_package(pybind11 REQUIRED)
find_package(Python3 COMPONENTS Interpreter Development REQUIRED)
find_package(Eigen3 REQUIRED)
find_package(Threads REQUIRED)
find_package(OpenMP REQUIRED)
find_package(TBB REQUIRED)

message(STATUS "Eigen3 include: ${EIGEN3_INCLUDE_DIR}")
message(STATUS "nlohmann_json: ${nlohmann_json_SOURCE_DIR}")

set(BINDINGS_ROOT ${CMAKE_SOURCE_DIR}/../bindings/python/opendxa_py)

set(LIBRARY_SOURCES
    src/core/property_base.cpp
    src/core/particle_property.cpp
    src/core/lammps_parser.cpp
    src/core/dislocation_analysis.cpp
    src/core/coordination_structures.cpp
    src/structures/cluster_graph.cpp
    src/structures/dislocation_network.cpp
    src/analysis/nearest_neighbor_finder.cpp
    src/analysis/crystal_path_finder.cpp
    src/analysis/burgers_loop_builder.cpp
    src/analysis/polyhedral_template_matching.cpp
    src/analysis/elastic_mapping.cpp
    src/analysis/structure_analysis.cpp
    src/analysis/common_neighbor_analysis.cpp
    src/geometry/interface_mesh.cpp
    src/geometry/delaunay_tessellation.cpp
    src/geometry/tri_mesh.cpp
    src/math/affine_decomposition.cpp
    src/utilities/json_exporter.cpp
)

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
    ${CMAKE_SOURCE_DIR}/dependencies/geogram
    ${EIGEN3_INCLUDE_DIR}
    ${CMAKE_SOURCE_DIR}/dependencies/ptm
    ${CMAKE_SOURCE_DIR}/dependencies/pybind11_json/include
    ${CMAKE_SOURCE_DIR}/dependencies/boost
)

target_link_libraries(opendxa_lib PUBLIC
    geogram
    PolyhedralTemplateMatching
    nlohmann_json::nlohmann_json
    Threads::Threads
    TBB::tbb
    OpenMP::OpenMP_CXX
)

# CLI executable
add_executable(opendxa src/core/main.cpp)
set_target_properties(opendxa PROPERTIES LINK_FLAGS_RELEASE "${LINKER_FAST}")
target_compile_options(opendxa PRIVATE
    $<$<CONFIG:Release>:${RELEASE_CXX_OPTS}>
)
target_compile_definitions(opendxa PRIVATE
    $<$<CONFIG:Release>:NDEBUG>
)
target_link_libraries(opendxa PRIVATE
    opendxa_lib
    OpenMP::OpenMP_CXX
)

# Python extension (pybind11)
pybind11_add_module(opendxa._core
    ${BINDINGS_ROOT}/src/main.cpp
    ${BINDINGS_ROOT}/src/bindings/module.cpp
    ${BINDINGS_ROOT}/src/bindings/dislocation_analysis.cpp
    ${BINDINGS_ROOT}/src/wrappers/dislocation_analysis.cpp
)

set_target_properties(opendxa._core PROPERTIES
    PREFIX ""
    OUTPUT_NAME "_core"
    LINK_FLAGS_RELEASE "${LINKER_FAST}"
)

target_link_libraries(opendxa._core PRIVATE opendxa_lib)
target_compile_options(opendxa._core PRIVATE
    $<$<CONFIG:Release>:${RELEASE_CXX_OPTS}>
)
target_compile_definitions(opendxa._core PRIVATE
    $<$<CONFIG:Release>:NDEBUG>
)
target_include_directories(opendxa._core PRIVATE
    ${CMAKE_SOURCE_DIR}/include
    ${CMAKE_SOURCE_DIR}/dependencies/geogram
    ${EIGEN3_INCLUDE_DIR}
    ${CMAKE_SOURCE_DIR}/dependencies/ptm
    ${CMAKE_SOURCE_DIR}/dependencies/pybind11_json/include
    ${BINDINGS_ROOT}/include
)

# Python extension (.so) into platform‐arch directory
install(TARGETS opendxa._core
    LIBRARY DESTINATION ${Python3_SITEARCH}/opendxa
)

install(FILES
    ${BINDINGS_ROOT}/opendxa/__init__.py
    DESTINATION ${Python3_SITELIB}/opendxa
)

install(DIRECTORY
    ${BINDINGS_ROOT}/opendxa/
    DESTINATION ${Python3_SITELIB}/opendxa
    FILES_MATCHING PATTERN "*.py"
)

# CLI and core library
install(TARGETS opendxa DESTINATION bin)
install(TARGETS opendxa_lib DESTINATION lib)

# Public headers
install(DIRECTORY ${CMAKE_SOURCE_DIR}/include/ DESTINATION include)
