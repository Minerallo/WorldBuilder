/*
  Copyright (C) 2018-2026 by the authors of the World Builder code.

  This file is part of the World Builder.

   This program is free software: you can redistribute it and/or modify
   it under the terms of the GNU Lesser General Public License as published
   by the Free Software Foundation, either version 2 of the License, or
   (at your option) any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU Lesser General Public License for more details.

   You should have received a copy of the GNU Lesser General Public License
   along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

#include "world_builder/features/continental_plate_models/topography/isostasy.h"


#include "world_builder/features/continental_plate_models/topography/interface.h"
#include "world_builder/nan.h"
#include "world_builder/types/array.h"
#include "world_builder/types/double.h"
#include "world_builder/types/object.h"
#include "world_builder/types/one_of.h"
#include "world_builder/types/value_at_points.h"

namespace WorldBuilder
{

  using namespace Utilities;

  namespace Features
  {
    namespace ContinentalPlateModels
    {
      namespace Topography
      {
        Isostasy::Isostasy(WorldBuilder::World *world_)
          :
          min_depth(NaN::DSNAN),
          max_depth(NaN::DSNAN),
          operation(Operations::REPLACE),
          crust_thickness(35e3),
          reference_crust_thickness(35e3),
          crust_density(2800.0),
          mantle_density(3300.0)
        {
          this->world = world_;
          this->name = "isostasy";
        }

        Isostasy::~Isostasy()
          = default;

        void
        Isostasy::declare_entries(Parameters &prm, const std::string & /*unused*/)
        {
          prm.declare_entry("", Types::Object(),
                            "Simple Airy isostasy topography model for continental crust.");

          prm.declare_entry("min depth", Types::OneOf(Types::Double(0),
                                                      Types::Array(Types::ValueAtPoints(0.,2)),
                                                      Types::String("")),
                            "The depth in meters from which this feature is present.");

          prm.declare_entry("max depth", Types::OneOf(Types::Double(std::numeric_limits<double>::max()),
                                                      Types::Array(Types::ValueAtPoints(std::numeric_limits<double>::max(),2)),
                                                      Types::String("")),
                            "The depth in meters to which this feature is present.");

          prm.declare_entry("crust thickness", Types::Double(35e3),
                            "Local crustal thickness in meters.");

          prm.declare_entry("reference crust thickness", Types::Double(35e3),
                            "Reference crustal thickness in meters for zero topography.");

          prm.declare_entry("crust density", Types::Double(2800.0),
                            "Crust density in kg/m^3.");

          prm.declare_entry("mantle density", Types::Double(3300.0),
                            "Mantle density in kg/m^3.");
        }

        void
        Isostasy::parse_entries(Parameters &prm, const std::vector<Point<2>> &coordinates)
        {
          min_depth_surface = Objects::Surface(prm.get("min depth",coordinates));
          min_depth = min_depth_surface.minimum;
          max_depth_surface = Objects::Surface(prm.get("max depth",coordinates));
          max_depth = max_depth_surface.maximum;
          operation = string_operations_to_enum(prm.get<std::string>("operation"));

          crust_thickness = prm.get<double>("crust thickness");
          reference_crust_thickness = prm.get<double>("reference crust thickness");
          crust_density = prm.get<double>("crust density");
          mantle_density = prm.get<double>("mantle density");

          WBAssertThrow(mantle_density > crust_density,
                        "For simple Airy isostasy, mantle density must be larger than crust density.");
        }

        double
        Isostasy::get_topography(const Point<3> & /*position_in_cartesian_coordinates*/,
                                 const Objects::NaturalCoordinate & /*position_in_natural_coordinates*/,
                                 double topography_) const
        {
          // Simple Airy isostasy topography calculation:
          const double new_topography =
            (crust_density / (mantle_density - crust_density)) *
            (crust_thickness - reference_crust_thickness);

          return apply_operation(operation, topography_, new_topography);
        }

        WB_REGISTER_FEATURE_CONTINENTAL_PLATE_TOPOGRAPHY_MODEL(Isostasy, isostasy)
      } // namespace Topography
    } // namespace ContinentalPlateModels
  } // namespace Features
} // namespace WorldBuilder

