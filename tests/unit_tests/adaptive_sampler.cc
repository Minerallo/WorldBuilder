/*
  Copyright (C) 2026 by the authors of the World Builder code.
*/

#define DOCTEST_CONFIG_SUPER_FAST_ASSERTS

#include "doctest/doctest.h"

#include "adaptive_sampler.h"
#include "world_builder/config.h"
#include "world_builder/world.h"

#include <algorithm>
#include <cmath>
#include <string>

TEST_CASE("Web adaptive sampler creates bounded 2D leaf cells")
{
  const std::string model =
    WorldBuilder::Data::WORLD_BUILDER_SOURCE_DIR +
    "/tests/gwb-grid/2d_cartesian_plume.wb";
  WorldBuilder::World world(model);

  const std::string grid_text =
    "grid_type = cartesian\n"
    "dim = 2\n"
    "compositions = 1\n"
    "x_min = 0\n"
    "x_max = 1e6\n"
    "z_min = 0\n"
    "z_max = 660e3\n"
    "n_cell_x = 32\n"
    "n_cell_z = 24\n";
  const WorldBuilder::Grid::Config grid =
    WorldBuilder::Grid::parse_config(grid_text, 64);
  WorldBuilder::Web::AdaptiveConfig config;
  config.base_resolution = 2;
  config.max_depth = 2;
  config.max_cells = 128;
  config.temperature_tolerance = 0.;
  config.composition_tolerance = 0.;

  const WorldBuilder::Web::AdaptiveResult result =
    WorldBuilder::Web::sample_adaptive(world, grid, config);

  CHECK(result.leaf_count() >= 4);
  CHECK(result.leaf_count() <= config.max_cells);
  CHECK(result.cell_bounds.size() == result.leaf_count() * 6);
  CHECK(result.grid.connectivity.size() == result.leaf_count() * 4);
  CHECK(result.grid.temperature.size() == result.grid.point_count());
  CHECK(result.grid.composition.size() == result.grid.point_count());
  CHECK(std::all_of(result.grid.temperature.begin(),
                    result.grid.temperature.end(),
                    [] (const double value) { return std::isfinite(value); }));
}

TEST_CASE("Web adaptive sampler preserves a coarse grid at high tolerance")
{
  const std::string model =
    WorldBuilder::Data::WORLD_BUILDER_SOURCE_DIR +
    "/tests/gwb-grid/2d_cartesian_plume.wb";
  WorldBuilder::World world(model);

  const std::string grid_text =
    "grid_type = cartesian\n"
    "dim = 2\n"
    "compositions = 0\n"
    "x_min = 0\n"
    "x_max = 1e6\n"
    "z_min = 0\n"
    "z_max = 660e3\n"
    "n_cell_x = 16\n"
    "n_cell_z = 16\n";
  const WorldBuilder::Grid::Config grid =
    WorldBuilder::Grid::parse_config(grid_text, 32);
  WorldBuilder::Web::AdaptiveConfig config;
  config.base_resolution = 2;
  config.max_depth = 3;
  config.max_cells = 256;
  config.temperature_tolerance = 1e20;
  config.composition_tolerance = 1e20;
  config.topography_tolerance = 1e20;
  config.refine_on_tag_change = false;

  const WorldBuilder::Web::AdaptiveResult result =
    WorldBuilder::Web::sample_adaptive(world, grid, config);

  CHECK(result.leaf_count() == 4);
  CHECK(result.maximum_level == 0);
  CHECK_FALSE(result.cell_limit_reached);
  CHECK(result.grid.point_count() == 9);
}

TEST_CASE("Web adaptive sampler subdivides a 3D cell into octants")
{
  const std::string model =
    WorldBuilder::Data::WORLD_BUILDER_SOURCE_DIR +
    "/tests/gwb-grid/cartesian_3d_topography.wb";
  WorldBuilder::World world(model);

  const std::string grid_text =
    "grid_type = cartesian\n"
    "dim = 3\n"
    "compositions = 3\n"
    "x_min = 0\n"
    "x_max = 40000\n"
    "y_min = 0\n"
    "y_max = 15000\n"
    "z_min = 0\n"
    "z_max = 10000\n"
    "n_cell_x = 16\n"
    "n_cell_y = 8\n"
    "n_cell_z = 8\n";
  const WorldBuilder::Grid::Config grid =
    WorldBuilder::Grid::parse_config(grid_text, 32);
  WorldBuilder::Web::AdaptiveConfig config;
  config.base_resolution = 1;
  config.max_depth = 1;
  config.max_cells = 8;
  config.temperature_tolerance = 0.;
  config.composition_tolerance = 0.;
  config.topography_tolerance = 0.;

  const WorldBuilder::Web::AdaptiveResult result =
    WorldBuilder::Web::sample_adaptive(world, grid, config);

  CHECK(result.leaf_count() == 8);
  CHECK(result.maximum_level == 1);
  CHECK(result.grid.connectivity.size() == 64);
  CHECK(result.grid.vertices_per_cell() == 8);
  CHECK(result.grid.temperature.size() == result.grid.point_count());
}
