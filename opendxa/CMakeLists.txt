cmake_minimum_required(VERSION 3.12)
project(DislocationAnalysis VERSION 1.0 LANGUAGES CXX)

option(DXA_BUILD_EXECUTABLE "Build the standalone DXA executable." ON)
option(DXA_BUILD_PYTHON_BINDINGS "Build Python bindings with pybind11." OFF)
option(DXA_ENABLE_DEBUG "Enable sanity checks (recommended)." ON)
option(DXA_USE_OPENMP "Enable OpenMP parallelization if available." ON)
option(DXA_BUILD_TESTS "Build unit tests" OFF)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Eigen3 3.3 REQUIRED NO_MODULE)
message(STATUS "Found Eigen3 version: ${Eigen3_VERSION}")

if(DXA_USE_OPENMP)
    find_package(OpenMP)
    if(OpenMP_CXX_FOUND)
        message(STATUS "OpenMP found - parallel processing enabled")
    else()
        message(WARNING "OpenMP not found - falling back to sequential processing")
    endif()
endif()

if(DXA_BUILD_PYTHON_BINDINGS)
    find_package(pybind11 QUIET)
    if(NOT pybind11_FOUND)
        message(WARNING "pybind11 not found - Python bindings will not be built")
        set(DXA_BUILD_PYTHON_BINDINGS OFF)
    else()
        message(STATUS "pybind11 found - Python bindings enabled")
    endif()
endif()

# ==================== Fuentes principales ====================
file(GLOB_RECURSE OPENDXA_SOURCES "src/*.cpp")
list(FILTER OPENDXA_SOURCES EXCLUDE REGEX ".*Main\\.cpp$")

add_library(opendxapy ${OPENDXA_SOURCES})

set_target_properties(opendxapy PROPERTIES
    POSITION_INDEPENDENT_CODE ON
    CXX_VISIBILITY_PRESET hidden
    VISIBILITY_INLINES_HIDDEN ON
)

target_include_directories(opendxapy 
    PUBLIC 
        ${CMAKE_CURRENT_SOURCE_DIR}/include
        ${CMAKE_CURRENT_SOURCE_DIR}/dependencies/cxxopts/include
        ${CMAKE_CURRENT_SOURCE_DIR}/dependencies/json/include
        ${CMAKE_CURRENT_SOURCE_DIR}/dependencies/polyhedral-template-matching/
        ${CMAKE_CURRENT_SOURCE_DIR}/dependencies/pybind11_json/include
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/src
)

target_link_libraries(opendxapy PUBLIC Eigen3::Eigen)

if(DXA_USE_OPENMP AND OpenMP_CXX_FOUND)
    target_link_libraries(opendxapy PUBLIC OpenMP::OpenMP_CXX)
    target_compile_definitions(opendxapy PUBLIC DXA_USE_OPENMP)
endif()

target_compile_options(opendxapy PRIVATE
    -fPIC
    $<$<CXX_COMPILER_ID:GNU>:-Wall -Wextra -O3 -march=native -ffast-math -funroll-loops>
    $<$<CXX_COMPILER_ID:Clang>:-Wall -Wextra -O3 -march=native -ffast-math -funroll-loops>
    $<$<CXX_COMPILER_ID:Intel>:-Wall -O3 -xHost -fp-model fast=2>
    $<$<CXX_COMPILER_ID:MSVC>:/W4 /O2 /fp:fast>
)

target_compile_definitions(opendxapy PRIVATE
    JSON_USE_IMPLICIT_CONVERSIONS=0
    JSON_DISABLE_ENUM_SERIALIZATION=1
)

set(PTM_LIB_DIR ${CMAKE_CURRENT_SOURCE_DIR}/dependencies/polyhedral-template-matching)

file(GLOB PTM_SOURCES
    "${PTM_LIB_DIR}/ptm_alloy_types.cpp"
    "${PTM_LIB_DIR}/ptm_canonical_coloured.cpp"
    "${PTM_LIB_DIR}/ptm_convex_hull_incremental.cpp"
    "${PTM_LIB_DIR}/ptm_correspondences.cpp"
    "${PTM_LIB_DIR}/ptm_deformation_gradient.cpp"
    "${PTM_LIB_DIR}/ptm_graph_data.cpp"
    "${PTM_LIB_DIR}/ptm_graph_tools.cpp"
    "${PTM_LIB_DIR}/ptm_index.cpp"
    "${PTM_LIB_DIR}/ptm_initialize_data.cpp"
    "${PTM_LIB_DIR}/ptm_map_templates.cpp" 
    "${PTM_LIB_DIR}/ptm_multishell.cpp"
    "${PTM_LIB_DIR}/ptm_neighbour_ordering.cpp"
    "${PTM_LIB_DIR}/ptm_normalize_vertices.cpp"
    "${PTM_LIB_DIR}/ptm_polar.cpp"
    "${PTM_LIB_DIR}/ptm_quat.cpp"
    "${PTM_LIB_DIR}/ptm_solid_angles.cpp" 
    "${PTM_LIB_DIR}/ptm_structure_matcher.cpp"
    "${PTM_LIB_DIR}/ptm_voronoi_cell.cpp"
)

add_library(ptm_lib STATIC ${PTM_SOURCES})
target_include_directories(ptm_lib PUBLIC ${PTM_LIB_DIR})

target_link_libraries(opendxapy PUBLIC ptm_lib)

if(DXA_BUILD_EXECUTABLE)
    find_package(OpenGL REQUIRED)
    message(STATUS "OpenGL found - visualization support enabled")

    add_executable(opendxa src/main.cpp)

    target_link_libraries(opendxa PRIVATE 
        opendxapy 
        ptm_lib
        OpenGL::GLU
    )

    target_compile_options(opendxa PRIVATE
        $<$<CXX_COMPILER_ID:GNU>:-O3 -march=native -ffast-math>
        $<$<CXX_COMPILER_ID:Clang>:-O3 -march=native -ffast-math>
        $<$<CXX_COMPILER_ID:Intel>:-O3 -xHost -fp-model fast=2>
        $<$<CXX_COMPILER_ID:MSVC>:/O2 /fp:fast>
    )
endif()

if(DXA_BUILD_PYTHON_BINDINGS AND pybind11_FOUND)
    find_package(OpenGL REQUIRED)
    message(STATUS "OpenGL found for Python bindings")

    pybind11_add_module(opendxa_py
        ${CMAKE_CURRENT_SOURCE_DIR}/../bindings/python/PyBindModule.cpp
    )

    target_link_libraries(opendxa_py PRIVATE 
        opendxapy 
        OpenGL::GL
        OpenGL::GLU
    )

    target_compile_definitions(opendxa_py PRIVATE 
        VERSION_INFO="${PROJECT_VERSION}"
    )

    set_target_properties(opendxa_py PROPERTIES
        OUTPUT_NAME "opendxa"
        PREFIX "${PYTHON_MODULE_PREFIX}"
        SUFFIX "${PYTHON_MODULE_EXTENSION}"
    )

    message(STATUS "Python bindings target 'opendxa_py' configured")
endif()

install(TARGETS opendxapy
    LIBRARY DESTINATION lib
    ARCHIVE DESTINATION lib
    RUNTIME DESTINATION bin
)

if(DXA_BUILD_EXECUTABLE)
    install(TARGETS opendxa
        RUNTIME DESTINATION bin
    )
endif()

if(DXA_BUILD_PYTHON_BINDINGS AND pybind11_FOUND)
    install(TARGETS opendxa_py
        LIBRARY DESTINATION ${CMAKE_INSTALL_PREFIX}/lib/python${PYTHON_VERSION_MAJOR}.${PYTHON_VERSION_MINOR}/site-packages
    )
endif()

message(STATUS "Build type: ${CMAKE_BUILD_TYPE}")
message(STATUS "C++ standard: ${CMAKE_CXX_STANDARD}")
message(STATUS "Build executable: ${DXA_BUILD_EXECUTABLE}")
message(STATUS "Build Python bindings: ${DXA_BUILD_PYTHON_BINDINGS}")
message(STATUS "Debug mode: ${DXA_ENABLE_DEBUG}")
message(STATUS "OpenMP support: ${DXA_USE_OPENMP}")
if(DXA_USE_OPENMP AND OpenMP_CXX_FOUND)
    message(STATUS "OpenMP version: ${OpenMP_CXX_VERSION}")
endif()
message(STATUS "Eigen3 version: ${Eigen3_VERSION}")
if(DXA_BUILD_PYTHON_BINDINGS)
    message(STATUS "pybind11 found: ${pybind11_FOUND}")
endif()
