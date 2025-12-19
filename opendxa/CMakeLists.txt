#
# Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.
#

cmake_minimum_required(VERSION 3.20 FATAL_ERROR)

project(OpenDXA VERSION 1.0.0 LANGUAGES CXX)

# Force PIC globally so that static libs can be linked into .so
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} -fsanitize=address,undefined -fno-omit-frame-pointer -g")

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
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -flto=thin")
else()
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -flto")
endif()

# Extra Release flags
set(RELEASE_CXX_OPTS
    -O3
    -march=native
    -fno-strict-aliasing
)

# Fast linker when using GNU/Clang
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    set(LINKER_FAST "-fuse-ld=gold")
endif()

# Force static libraries
set(BUILD_SHARED_LIBS OFF CACHE BOOL "Build all libs static" FORCE)

include_directories(${CMAKE_SOURCE_DIR}/include)

# External packages
find_package(Threads REQUIRED)
find_package(OpenMP REQUIRED)
find_package(TBB REQUIRED)
find_package(spdlog REQUIRED)

message(STATUS "nlohmann_json: ${nlohmann_json_SOURCE_DIR}")

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
    spdlog::spdlog
)

# Function executables from src/functions/
file(GLOB FUNCTION_SOURCES ${CMAKE_SOURCE_DIR}/src/functions/*.cpp)

foreach(FUNC_SRC ${FUNCTION_SOURCES})
    get_filename_component(FUNC_NAME ${FUNC_SRC} NAME_WE)
    set(EXEC_NAME "opendxa-${FUNC_NAME}")
    
    add_executable(${EXEC_NAME} ${FUNC_SRC})
    set_target_properties(${EXEC_NAME} PROPERTIES LINK_FLAGS_RELEASE "${LINKER_FAST}")
    target_compile_options(${EXEC_NAME} PRIVATE
        $<$<CONFIG:Release>:${RELEASE_CXX_OPTS}>
        $<$<CONFIG:Debug>:${DEBUG_CXX_OPTS}>
    )
    target_compile_definitions(${EXEC_NAME} PRIVATE
        $<$<CONFIG:Release>:NDEBUG>
    )
    target_link_libraries(${EXEC_NAME} PRIVATE
        opendxa_lib
        spdlog::spdlog
        OpenMP::OpenMP_CXX
    )
    
    install(TARGETS ${EXEC_NAME} DESTINATION bin)
endforeach()

# CLI and core library
install(TARGETS opendxa_lib DESTINATION lib)

# Public headers
install(DIRECTORY ${CMAKE_SOURCE_DIR}/include/ DESTINATION include)
