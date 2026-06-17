"use client";

import { useMemo } from "react";
import Map, { Source, Layer, MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

interface UserRisk {
  user_id: string;
  phase2_risk: number;
  category: string;
  top_geo: string | null;
  vitals_anomalies_p2: number;
}

export default function RiskHeatmap({ data }: { data: UserRisk[] }) {
  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

  const getCoordinates = (geo: string | null) => {
    const jitter = () => (Math.random() - 0.5) * 0.5;
    if (geo?.startsWith("s1")) return [3.37 + jitter(), 6.52 + jitter()];
    if (geo?.startsWith("s4")) return [8.59 + jitter(), 12.0 + jitter()];
    if (geo?.startsWith("s0")) return [7.04 + jitter(), 4.81 + jitter()];
    return [7.5 + jitter(), 9.05 + jitter()];
  };

  const geojson = useMemo(() => {
    const features = data
      .filter((u) => u.phase2_risk > 0)
      .map((u) => ({
        type: "Feature",
        properties: {
          mag: u.phase2_risk / 100,
          category: u.category,
          userId: u.user_id,
        },
        geometry: {
          type: "Point",
          coordinates: getCoordinates(u.top_geo),
        },
      }));

    return { type: "FeatureCollection", features };
  }, [data]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 rounded-lg border border-gray-200 text-gray-400">
        <span className="mb-2">🗺️</span>
        <p className="text-sm">Mapbox token missing in environment.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-lg overflow-hidden relative border border-gray-200">
      <Map
        initialViewState={{
          longitude: 8.0,
          latitude: 9.5,
          zoom: 4.5,
        }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        attributionControl={false}
      >
        <Source type="geojson" data={geojson as any}>
          <Layer
            id="risk-heatmap"
            type="heatmap"
            paint={{
              "heatmap-weight": [
                "interpolate",
                ["linear"],
                ["get", "mag"],
                0,
                0,
                1,
                1,
              ],
              "heatmap-color": [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0,
                "rgba(59,130,246,0)",
                0.2,
                "rgb(147,197,253)",
                0.4,
                "rgb(253,224,71)",
                0.6,
                "rgb(251,146,60)",
                0.8,
                "rgb(239,68,68)",
                1,
                "rgb(185,28,28)",
              ],
              "heatmap-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                0,
                15,
                9,
                30,
              ],
              "heatmap-opacity": 0.7,
            }}
          />
          <Layer
            id="risk-points"
            type="circle"
            filter={["==", ["get", "category"], "escalating"]}
            paint={{
              "circle-radius": 4,
              "circle-color": "#EF4444",
              "circle-stroke-width": 1.5,
              "circle-stroke-color": "#ffffff",
            }}
          />
        </Source>
      </Map>
    </div>
  );
}
