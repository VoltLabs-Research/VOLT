from setuptools import setup, find_packages
from pybind11.setup_helpers import Pybind11Extension, build_ext
import os
from pathlib import Path

OPENDXA_ROOT = os.path.abspath('../../opendxa')
OPENDXA_PY_ROOT = os.path.abspath('.')
INCLUDE_DIR = os.path.join(OPENDXA_ROOT, 'include')
SRC_DIR = os.path.join(OPENDXA_ROOT, 'src')

def find_cpp_files_recursive(directory, exclude_patterns=None):
    if exclude_patterns is None:
        exclude_patterns = []
    
    cpp_files = []
    
    if not os.path.exists(directory):
        print(f"Warning: Directory {directory} does not exist")
        return cpp_files
    
    directory_path = Path(directory)
    
    for cpp_file in directory_path.rglob("*.cpp"):
        file_path = str(cpp_file.absolute())
        file_name = cpp_file.name
        relative_path = str(cpp_file.relative_to(directory_path))
        
        should_exclude = False
        for pattern in exclude_patterns:
            if pattern in file_name or pattern in relative_path:
                should_exclude = True
                break
        
        if not should_exclude:
            cpp_files.append(file_path)
            print(f"  Found: {relative_path}")
        else:
            print(f"  Excluded: {relative_path}")
    
    return cpp_files

def collect_cpp_files():
    print("=== Scanning for C++ source files ===\n")
    
    all_cpp_files = []
    
    print("1. Scanning OpenDXA core source files...")
    core_exclude_patterns = [
        'main.cpp',
    ]
    
    core_files = find_cpp_files_recursive(SRC_DIR, core_exclude_patterns)
    all_cpp_files.extend(core_files)
    print(f"   -> Found {len(core_files)} core files\n")
    
    print("2. Scanning Python binding files...")
    bindings_dir = os.path.join(OPENDXA_PY_ROOT, 'bindings')
    binding_files = find_cpp_files_recursive(bindings_dir)
    all_cpp_files.extend(binding_files)
    print(f"   -> Found {len(binding_files)} binding files\n")

    print("3. Scanning wrapper files...")
    wrappers_dir = os.path.join(OPENDXA_PY_ROOT, 'wrappers')
    wrapper_files = find_cpp_files_recursive(wrappers_dir)
    all_cpp_files.extend(wrapper_files)
    print(f"   -> Found {len(wrapper_files)} wrapper files\n")
    
    print("4. Scanning function files...")
    functions_dir = os.path.join(OPENDXA_PY_ROOT, 'functions')
    function_files = find_cpp_files_recursive(functions_dir)
    all_cpp_files.extend(function_files)
    print(f"   -> Found {len(function_files)} function files\n")
    
    print("5. Looking for main module file...")
    main_candidates = [
        os.path.join(OPENDXA_PY_ROOT, 'main.cpp'),
        os.path.join(OPENDXA_PY_ROOT, 'PyBindModule.cpp'),
        os.path.join(OPENDXA_PY_ROOT, 'module.cpp'),
        os.path.join(OPENDXA_PY_ROOT, 'pybind_module.cpp'),
    ]
    
    main_file_found = False
    for main_candidate in main_candidates:
        if os.path.exists(main_candidate):
            all_cpp_files.append(main_candidate)
            print(f"   -> Found main file: {os.path.basename(main_candidate)}")
            main_file_found = True
            break
    
    if not main_file_found:
        print("   -> Warning: No main module file found!")
        print(f"   -> Expected one of: {[os.path.basename(f) for f in main_candidates]}")
    
    print()
    
    print("6. Scanning for additional C++ files in opendxa_py root...")
    root_cpp_files = []
    for file in os.listdir(OPENDXA_PY_ROOT):
        if file.endswith('.cpp') and file not in [os.path.basename(f) for f in main_candidates]:
            file_path = os.path.join(OPENDXA_PY_ROOT, file)
            root_cpp_files.append(file_path)
            print(f"   -> Found additional file: {file}")
    
    all_cpp_files.extend(root_cpp_files)
    if not root_cpp_files:
        print("   -> No additional files found")
    
    print()
    
    seen = set()
    unique_files = []
    for file in all_cpp_files:
        normalized_path = os.path.normpath(file)
        if normalized_path not in seen:
            seen.add(normalized_path)
            unique_files.append(file)
    
    return unique_files

def get_include_dirs():
    include_dirs = [
        INCLUDE_DIR,
        OPENDXA_PY_ROOT,
        os.path.join(OPENDXA_ROOT, 'dependencies', 'cxxopts', 'include'),
        SRC_DIR,
    ]
    
    # Directorios del sistema comunes
    system_includes = [
        '/usr/include/GL',
        '/usr/include/eigen3',
        '/usr/include/opencv4',
        '/usr/local/include',
        '/opt/local/include',
    ]
    
    for sys_include in system_includes:
        if os.path.exists(sys_include):
            include_dirs.append(sys_include)
    
    opendxa_py_includes = [
        os.path.join(OPENDXA_PY_ROOT, 'include'),
        os.path.join(OPENDXA_PY_ROOT, 'bindings'),
        os.path.join(OPENDXA_PY_ROOT, 'wrappers'),
        os.path.join(OPENDXA_PY_ROOT, 'functions'),
    ]
    
    for include_dir in opendxa_py_includes:
        if os.path.exists(include_dir):
            include_dirs.append(include_dir)
    
    return include_dirs

def get_libraries():
    base_libraries = [
        'pthread',
        'dl',
        'm',
    ]
    
    optional_libraries = [
        ('GL', ['/usr/lib/x86_64-linux-gnu/libGL.so', '/usr/lib64/libGL.so']),
        ('GLU', ['/usr/lib/x86_64-linux-gnu/libGLU.so', '/usr/lib64/libGLU.so']),
        ('gomp', ['/usr/lib/x86_64-linux-gnu/libgomp.so', '/usr/lib64/libgomp.so']),
    ]
    
    libraries = base_libraries.copy()
    
    for lib_name, lib_paths in optional_libraries:
        lib_found = any(os.path.exists(path) for path in lib_paths)
        if lib_found:
            libraries.append(lib_name)
            print(f"   -> Found library: {lib_name}")
        else:
            print(f"   -> Library not found: {lib_name} (optional)")
    
    return libraries

def get_library_dirs():
    potential_lib_dirs = [
        '/usr/lib/x86_64-linux-gnu',
        '/usr/lib64',
        '/usr/lib',
        '/usr/local/lib',
        '/opt/local/lib',
        '/lib/x86_64-linux-gnu',
        '/lib64',
    ]
    
    existing_lib_dirs = []
    for lib_dir in potential_lib_dirs:
        if os.path.exists(lib_dir):
            existing_lib_dirs.append(lib_dir)
    
    return existing_lib_dirs

print("=" * 60)
print("OpenDXA Python Build Configuration")
print("=" * 60)
print(f"OpenDXA Root: {OPENDXA_ROOT}")
print(f"OpenDXA Python Root: {OPENDXA_PY_ROOT}")
print()

cpp_files = collect_cpp_files()
include_dirs = get_include_dirs()
libraries = get_libraries()
library_dirs = get_library_dirs()

print("=" * 60)
print("BUILD SUMMARY")
print("=" * 60)
print(f"Total C++ files: {len(cpp_files)}")
print(f"Include directories: {len(include_dirs)}")
print(f"Libraries: {len(libraries)}")
print(f"Library directories: {len(library_dirs)}")
print()

print("Files to compile:")
for i, file in enumerate(cpp_files, 1):
    rel_path = os.path.relpath(file)
    print(f"  {i:2d}. {rel_path}")

print()
print("Include directories:")
for i, inc_dir in enumerate(include_dirs, 1):
    exists = "✓" if os.path.exists(inc_dir) else "✗"
    print(f"  {i:2d}. {exists} {inc_dir}")

print()
print("Libraries:", ", ".join(libraries))
print("=" * 60)

# Configuración de la extensión
ext_modules = [
    Pybind11Extension(
        'opendxa._core',
        cpp_files,
        include_dirs=include_dirs,
        libraries=libraries,
        library_dirs=library_dirs,
        cxx_std=17,
        define_macros=[
            ('VERSION_INFO', '"1.0.0"'),
            ('NDEBUG', '1'),
            ('BUILD_TIMESTAMP', '"2025-06-12 07:05:33"'),
            ('BUILD_USER', '"rodyherrera"'),
        ],
        extra_compile_args=[
            '-O3',
            '-march=native',
            '-ffast-math',
            '-fopenmp',
            '-fPIC',
            '-Wall',
            '-Wextra',
            '-Wno-unused-parameter',
            '-Wno-unused-variable',
            '-Wno-sign-compare',
        ],
        extra_link_args=[
            '-fopenmp',
        ],
    )
]

# Setup
setup(
    name='opendxa',
    version='1.0.0',
    packages=find_packages(),
    author='rodyherrera',
    author_email='contact@rodyherrera.com',
    description='Open Source Dislocation Extraction Algorithm',
    ext_modules=ext_modules,
    cmdclass={'build_ext': build_ext},
    python_requires='>=3.8',
    install_requires=[
        'numpy>=1.20.0',
        'pybind11>=2.10.0',
    ],
    setup_requires=[
        'pybind11>=2.10.0',
    ]
)