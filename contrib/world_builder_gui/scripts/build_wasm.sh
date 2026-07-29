#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_dir="$(cd "${script_dir}/../../.." && pwd)"
build_dir="${source_dir}/build-web"

emcmake cmake -S "${source_dir}" -B "${build_dir}" \
  -DCMAKE_BUILD_TYPE=Release \
  -DWB_ENABLE_WEB=ON \
  -DWB_ENABLE_APPS=OFF \
  -DWB_ENABLE_TESTS=OFF \
  -DWB_ENABLE_HELPER_TARGETS=OFF \
  -DWB_MAKE_FORTRAN_WRAPPER=OFF \
  -DWB_ENABLE_PYTHON=OFF \
  -DWB_USE_ZLIB=OFF \
  -DUSE_MPI=OFF \
  -DWB_UNITY_BUILD=OFF

cmake --build "${build_dir}" --target gwb-web --parallel
