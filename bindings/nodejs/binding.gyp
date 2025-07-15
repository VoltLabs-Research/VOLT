{
  "targets": [
    {
      "target_name": "opendxa_node",
      "sources": [
        "src/addon.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "/usr/include/eigen3",
        "../../opendxa/include",
        "../../opendxa/dependencies/geogram",
        "../../opendxa/dependencies/ptm"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": ["-fno-exceptions", "-fno-rtti"],
      "cflags_cc!": ["-fno-exceptions", "-fno-rtti"],
      "defines": [
        "NAPI_CPP_EXCEPTIONS"
      ],
      "conditions": [
        ["OS=='linux'", {
          "cflags_cc": [
            "-std=c++26", 
            "-fPIC", 
            "-frtti", 
            "-fexceptions",
            "-fopenmp"
          ],
          "libraries": [
            "<(module_root_dir)/../../opendxa/build/libopendxa_lib.a",
            "<(module_root_dir)/../../opendxa/build/dependencies/geogram/libgeogram.a",
            "<(module_root_dir)/../../opendxa/build/dependencies/ptm/libPolyhedralTemplateMatching.a",
            "-ltbb",
            "-lspdlog",
            "-lgomp", 
            "-lpthread",
            "-ldl"
          ]
        }]
      ]
    }
  ]
}
