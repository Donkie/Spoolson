import { ExternalFilament } from "../../utils/queryExternalDB";
import { getAPIURL } from "../../utils/url";
import { getOrCreateVendorFromExternal } from "../vendors/functions";
import { IFilament } from "./model";

/**
 * Create a new internal filament given an external filament object.
 * Returns the created internal filament.
 */
export async function createFilamentFromExternal(externalFilament: ExternalFilament): Promise<IFilament> {
  const vendor = await getOrCreateVendorFromExternal(externalFilament.manufacturer);

  let color_hex: string | undefined = undefined;
  let multi_color_hexes: string | undefined = undefined;
  let multi_color_direction: string | undefined = undefined;
  if (externalFilament.color_hex) {
    color_hex = externalFilament.color_hex;
  } else if (externalFilament.color_hexes && externalFilament.color_hexes.length > 0) {
    multi_color_hexes = externalFilament.color_hexes.join(",")
    multi_color_direction = externalFilament.multi_color_direction
  }

  const body: Omit<IFilament, "id" | "registered" | "extra"> & { vendor_id: number } = {
    name: externalFilament.name,
    material: externalFilament.material,
    vendor_id: vendor.id,
    price: externalFilament.price,
    density: externalFilament.density,
    diameter: externalFilament.diameter,
    weight: externalFilament.weight,
    spool_weight: externalFilament.spool_weight || undefined,
    color_hex: color_hex,
    multi_color_hexes: multi_color_hexes,
    multi_color_direction: multi_color_direction,
    settings_extruder_temp: externalFilament.extruder_temp || undefined,
    settings_bed_temp: externalFilament.bed_temp || undefined,
    external_id: externalFilament.id,
  };

  const response = await fetch(getAPIURL() + "/filament", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error("Network response was not ok");
  }
  return response.json();
}
