/*
  Copyright (C) 2026 by the authors of the World Builder code.
*/

#define DOCTEST_CONFIG_SUPER_FAST_ASSERTS

#include "doctest/doctest.h"

#include "world_builder/config.h"
#include "world_builder/grid_sampler.h"
#include "world_builder/world.h"

#include <algorithm>
#include <cmath>
#include <string>

using doctest::Approx;

TEST_CASE("Browser grid configuration parsing and resolution limiting")
{
  const std::string text =
    "grid_type = cartesian\n"
    "dim = 2\n"
    "compositions = 2\n"
    "x_min = 0\n"
    "x_max = 550e3\n"
    "z_min = 0\n"
    "z_max = 350e3\n"
    "n_cell_x = 28\n"
    "n_cell_z = 18\n";

  const WorldBuilder::Grid::Config config =
    WorldBuilder::Grid::parse_config(text, 20);
  CHECK(config.type == "cartesian");
  CHECK(config.dimension == 2);
  CHECK(config.compositions == 2);
  CHECK(config.cells_x == 20);
  CHECK(config.cells_z == 18);
  CHECK(config.x_max == Approx(550e3));
}

TEST_CASE("Browser sampler produces a contiguous Cartesian thermal grid")
{
  const std::string model =
    WorldBuilder::Data::WORLD_BUILDER_SOURCE_DIR +
    "/tests/gwb-grid/2d_cartesian_plume.wb";
  WorldBuilder::World world(model);

  const std::string grid =
    "grid_type = cartesian\n"
    "dim = 2\n"
    "compositions = 1\n"
    "x_min = 0\n"
    "x_max = 1e6\n"
    "z_min = 0\n"
    "z_max = 660e3\n"
    "n_cell_x = 4\n"
    "n_cell_z = 3\n";

  const WorldBuilder::Grid::Result result =
    WorldBuilder::Grid::sample(world,
      WorldBuilder::Grid::parse_config(grid, 16));

  CHECK(result.dimension == 2);
  CHECK(result.point_count() == 20);
  CHECK(result.cell_count() == 12);
  CHECK(result.points.size() == 60);
  CHECK(result.connectivity.size() == 48);
  CHECK(result.temperature.size() == 20);
  CHECK(result.velocity.size() == 60);
  CHECK(result.tags.size() == 20);
  CHECK(result.composition.size() == 20);
  CHECK(std::all_of(result.temperature.begin(), result.temperature.end(),
                    [] (const double value) { return std::isfinite(value); }));
}

TEST_CASE("Browser sampler produces a spherical chunk grid")
{
  const std::string model =
    WorldBuilder::Data::WORLD_BUILDER_SOURCE_DIR +
    "/tests/gwb-grid/chunk_topography.wb";
  WorldBuilder::World world(model);

  const std::string grid =
    "grid_type = chunk\n"
    "dim = 3\n"
    "compositions = 1\n"
    "x_min = 0\n"
    "x_max = 4\n"
    "y_min = 0\n"
    "y_max = 3\n"
    "z_min = 6341000\n"
    "z_max = 6371000\n"
    "n_cell_x = 2\n"
    "n_cell_y = 2\n"
    "n_cell_z = 2\n";

  const WorldBuilder::Grid::Result result =
    WorldBuilder::Grid::sample(world,
      WorldBuilder::Grid::parse_config(grid, 16));

  CHECK(result.dimension == 3);
  CHECK(result.point_count() == 27);
  CHECK(result.cell_count() == 8);
  CHECK(result.connectivity.size() == 64);
  CHECK(result.temperature.size() == 27);
  CHECK(result.composition.size() == 27);
}
