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
set(CMAKE_CXX_STANDARD 26)
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
  -O3 -march=native -funroll-loops
  -fstrict-aliasing -fno-unsafe-math-optimizations
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
find_package(spdlog REQUIRED)

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
    src/analysis/delaunay_tessellation_spatial_query.cpp
    src/analysis/nearest_neighbor_finder.cpp
    src/analysis/crystal_path_finder.cpp
    src/analysis/burgers_loop_builder.cpp
    src/analysis/polyhedral_template_matching.cpp
    src/analysis/elastic_mapping.cpp
    src/analysis/structure_analysis.cpp
    src/analysis/common_neighbor_analysis.cpp
    src/geometry/interface_mesh.cpp
    src/geometry/delaunay_tessellation.cpp
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
    spdlog::spdlog
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
    spdlog::spdlog
    OpenMP::OpenMP_CXX
)

# Node.js bindings
message(STATUS "Building Node.js binding...")

# Find Node.js installation
find_program(NODE_EXECUTABLE node)
if(NOT NODE_EXECUTABLE)
    message(FATAL_ERROR "Node.js not found. Please install Node.js.")
endif()

# Get Node.js version and paths with better detection
execute_process(
    COMMAND ${NODE_EXECUTABLE} -e "console.log(process.version)"
    OUTPUT_VARIABLE NODE_VERSION
    OUTPUT_STRIP_TRAILING_WHITESPACE
)

execute_process(
    COMMAND ${NODE_EXECUTABLE} -e "console.log(process.config.variables.node_module_version)"
    OUTPUT_VARIABLE NODE_MODULE_VERSION
    OUTPUT_STRIP_TRAILING_WHITESPACE
)

# Better Node.js prefix detection
execute_process(
    COMMAND ${NODE_EXECUTABLE} -e "
        const path = require('path');
        const prefix = process.config.variables.node_prefix || 
                        process.env.NODE_PREFIX || 
                        path.dirname(path.dirname(process.execPath));
        console.log(prefix);
    "
    OUTPUT_VARIABLE NODE_PREFIX
    OUTPUT_STRIP_TRAILING_WHITESPACE
)

# Alternative method for Node.js include directory detection
execute_process(
    COMMAND ${NODE_EXECUTABLE} -e "
        const path = require('path');
        // Try multiple possible locations
        const possiblePaths = [
            path.join(process.config.variables.node_prefix || '', 'include', 'node'),
            path.join(path.dirname(path.dirname(process.execPath)), 'include', 'node'),
            '/usr/include/node',
            '/usr/local/include/node',
            '/opt/node/include/node'
        ];
        const fs = require('fs');
        for (const p of possiblePaths) {
            if (fs.existsSync(path.join(p, 'node.h'))) {
                console.log(p);
                process.exit(0);
            }
        }
        console.log('NOT_FOUND');
    "
    OUTPUT_VARIABLE NODE_INCLUDE_DIR
    OUTPUT_STRIP_TRAILING_WHITESPACE
)

# Try to find node-addon-api in current directory or parent directories
execute_process(
    COMMAND ${NODE_EXECUTABLE} -e "
        const path = require('path');
        const fs = require('fs');
        let currentDir = process.cwd();
        
        // Check current directory first
        try {
            const napiPath = path.join(currentDir, 'node_modules', 'node-addon-api');
            if (fs.existsSync(napiPath)) {
                console.log(napiPath);
                process.exit(0);
            }
        } catch(e) {}
        
        // Check parent directories
        const bindings_dir = path.join(__dirname, '..', 'bindings', 'nodejs');
        try {
            const napiPath = path.join(bindings_dir, 'node_modules', 'node-addon-api');
            if (fs.existsSync(napiPath)) {
                console.log(napiPath);
                process.exit(0);
            }
        } catch(e) {}
        
        // Try to require it
        try {
            const napi = require('node-addon-api');
            console.log(napi.include_dir || napi.include || 'node_modules/node-addon-api');
        } catch(e) {
            console.log('NOT_FOUND');
        }
    "
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    OUTPUT_VARIABLE NODE_ADDON_API_DIR
    OUTPUT_STRIP_TRAILING_WHITESPACE
    RESULT_VARIABLE NODE_ADDON_API_RESULT
)

message(STATUS "Node.js version: ${NODE_VERSION}")
message(STATUS "Node.js module version: ${NODE_MODULE_VERSION}")
message(STATUS "Node.js prefix: ${NODE_PREFIX}")
message(STATUS "Node.js include dir detected: ${NODE_INCLUDE_DIR}")

# Validate Node.js headers
if(NODE_INCLUDE_DIR STREQUAL "NOT_FOUND" OR NOT EXISTS "${NODE_INCLUDE_DIR}/node.h")
    message(STATUS "Attempting to install Node.js development headers...")
    
    # Try common package managers
    find_program(APT_GET_EXECUTABLE apt-get)
    find_program(YUM_EXECUTABLE yum)
    find_program(PACMAN_EXECUTABLE pacman)
    
    if(APT_GET_EXECUTABLE)
        message(STATUS "Try: sudo apt-get install nodejs-dev")
    elseif(YUM_EXECUTABLE)
        message(STATUS "Try: sudo yum install nodejs-devel")  
    elseif(PACMAN_EXECUTABLE)
        message(STATUS "Try: sudo pacman -S nodejs-lts-hydrogen")
    endif()
    
    message(FATAL_ERROR "
Node.js headers not found. Tried: ${NODE_INCLUDE_DIR}

Install Node.js development headers:
Ubuntu/Debian: sudo apt-get install nodejs-dev
CentOS/RHEL:   sudo yum install nodejs-devel  
Arch Linux:    sudo pacman -S nodejs

Or install Node.js from NodeSource/official website.
")
endif()

if(NODE_ADDON_API_DIR STREQUAL "NOT_FOUND")
    message(FATAL_ERROR "
node-addon-api not found. 

Install it with:
cd ${CMAKE_SOURCE_DIR}/../bindings/nodejs
npm install node-addon-api

Or globally:
npm install -g node-addon-api
")
else()
    message(STATUS "Found node-addon-api at: ${NODE_ADDON_API_DIR}")
endif()

# Node.js addon
set(NODEJS_SOURCES
    ${CMAKE_SOURCE_DIR}/../bindings/nodejs/src/addon.cpp
)

if(NOT EXISTS "${CMAKE_SOURCE_DIR}/../bindings/nodejs/src/addon.cpp")
    message(FATAL_ERROR "Node.js binding source not found at ${CMAKE_SOURCE_DIR}/../bindings/nodejs/src/addon.cpp")
endif()

add_library(opendxa_node SHARED ${NODEJS_SOURCES})

# Set Node.js addon properties
set_target_properties(opendxa_node PROPERTIES
    PREFIX ""
    SUFFIX ".node"
    POSITION_INDEPENDENT_CODE ON
    CXX_STANDARD 26
    LINK_FLAGS_RELEASE "${LINKER_FAST}"
)

# Apply same compilation flags as main library
target_compile_options(opendxa_node PRIVATE
    $<$<CONFIG:Release>:${RELEASE_CXX_OPTS}>
    -fexceptions
    -frtti
)

target_compile_definitions(opendxa_node PRIVATE
    NAPI_CPP_EXCEPTIONS
    $<$<CONFIG:Release>:NDEBUG>
)

target_include_directories(opendxa_node PRIVATE
    ${NODE_INCLUDE_DIR}
    ${NODE_ADDON_API_DIR}
    ${CMAKE_SOURCE_DIR}/include
    ${CMAKE_SOURCE_DIR}/dependencies/geogram
    ${EIGEN3_INCLUDE_DIR}
    ${CMAKE_SOURCE_DIR}/dependencies/ptm
    ${CMAKE_SOURCE_DIR}/dependencies/boost
)

target_link_libraries(opendxa_node PRIVATE
    opendxa_lib
    ${CMAKE_DL_LIBS}
)

# Install Node.js addon
install(TARGETS opendxa_node 
    LIBRARY DESTINATION ${CMAKE_SOURCE_DIR}/../bindings/nodejs/build/Release/
)

message(STATUS "Node.js binding configured successfully")

# Python extension (pybind11)
pybind11_add_module(opendxa._core
    ${BINDINGS_ROOT}/src/main.cpp
    ${BINDINGS_ROOT}/src/bindings/module.cpp
    ${BINDINGS_ROOT}/src/bindings/python_sink.cpp
    ${BINDINGS_ROOT}/src/bindings/dislocation_analysis.cpp
    ${BINDINGS_ROOT}/src/wrappers/dislocation_analysis.cpp
)

set_target_properties(opendxa._core PROPERTIES
    PREFIX ""
    OUTPUT_NAME "_core"
    LINK_FLAGS_RELEASE "${LINKER_FAST}"
)

target_link_libraries(opendxa._core PRIVATE opendxa_lib spdlog::spdlog)
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
