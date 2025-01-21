import { useQuery } from "@tanstack/react-query";
import { getAPIURL } from "./url";

export enum SpoolType {
  PLASTIC = "plastic",
  CARDBOARD = "cardboard",
  METAL = "metal",
}

export enum Finish {
  MATTE = "matte",
  GLOSSY = "glossy",
}

export enum MultiColorDirection {
  COAXIAL = "coaxial",
  LONGITUDINAL = "longitudinal",
}

export enum Pattern {
  MARBLE = "marble",
  SPARKLE = "sparkle",
}

export interface ExternalFilament {
  id: string;
  manufacturer: string;
  name: string;
  material: string;
  prices: { [key: string]: number}
  price?: number,
  density: number;
  weight: number;
  spool_weight?: number;
  spool_type?: SpoolType;
  diameter: number;
  color_hex?: string;
  color_hexes?: string[];
  extruder_temp?: number;
  bed_temp?: number;
  finish?: Finish;
  multi_color_direction?: MultiColorDirection;
  pattern?: Pattern;
  translucent: boolean;
  glow: boolean;
}

export interface ExternalMaterial {
  material: string;
  density: number;
  extruder_temp: number | null;
  bed_temp: number | null;
}

export function useGetExternalDBFilaments(currency: string) {
  return useQuery<ExternalFilament[]>({
    queryKey: ["external", "filaments"],
    staleTime: 60,
    queryFn: async () => {
      const response = await fetch(`${getAPIURL()}/external/filament`);
      return response.json();
    },
    select: data => data.map(fil => { // Set price to current currency
      fil.price = fil.prices?.[currency]; 
      return (fil as ExternalFilament); 
    })
  });
}

export function useGetExternalDBMaterials() {
  return useQuery<ExternalMaterial[]>({
    queryKey: ["external", "materials"],
    staleTime: 60,
    queryFn: async () => {
      const response = await fetch(`${getAPIURL()}/external/material`);
      return response.json();
    },
  });
}
