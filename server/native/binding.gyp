{
  "targets": [
    {
      "target_name": "stats_parser",
      "sources": ["src/stats_parser.cpp"],
      "include_dirs": [],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags": ["-O3", "-march=native", "-ffast-math"],
      "cflags_cc": ["-O3", "-march=native", "-ffast-math", "-std=c++17"],
      "defines": ["NAPI_CPP_EXCEPTIONS"]
    },
    {
      "target_name": "dump_parser",
      "sources": ["src/dump_parser.cpp"],
      "include_dirs": [],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags": ["-O3", "-march=native", "-ffast-math"],
      "cflags_cc": ["-O3", "-march=native", "-ffast-math", "-std=c++17"],
      "defines": ["NAPI_CPP_EXCEPTIONS"]
    },
    {
      "target_name": "data_parser",
      "sources": ["src/data_parser.cpp"],
      "include_dirs": [],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags": ["-O3", "-march=native", "-ffast-math"],
      "cflags_cc": ["-O3", "-march=native", "-ffast-math", "-std=c++17"],
      "defines": ["NAPI_CPP_EXCEPTIONS"]
    },
    {
      "target_name": "glb_exporter",
      "sources": ["src/glb_exporter.cpp"],
      "include_dirs": [],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags": ["-O3", "-march=native", "-ffast-math", "-pthread"],
      "cflags_cc": ["-O3", "-march=native", "-ffast-math", "-std=c++17", "-pthread"],
      "ldflags": ["-pthread"],
      "defines": ["NAPI_CPP_EXCEPTIONS"]
    },
    {
      "target_name": "rasterizer",
      "sources": ["src/rasterizer.cpp"],
      "include_dirs": [],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags": ["-O3", "-march=native", "-ffast-math", "-pthread"],
      "cflags_cc": ["-O3", "-march=native", "-ffast-math", "-std=c++17", "-pthread"],
      "ldflags": ["-pthread"],
      "defines": ["NAPI_CPP_EXCEPTIONS"]
    }
  ]
}
