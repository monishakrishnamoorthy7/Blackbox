import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { useDashboard } from "../../context/DashboardContext.jsx";
import { CHENNAI_CENTER, DEVICE_ID } from "../../config.js";
import { formatCoord, mapPosition } from "../../utils/format.js";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function Recenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom() > 12 ? map.getZoom() : 14, { duration: 0.6 });
  }, [lat, lng, map]);
  return null;
}

export default function LiveMap({ className = "h-[360px]" }) {
  const { telemetry, gpsOk, deviceId } = useDashboard();
  const position = mapPosition(telemetry, CHENNAI_CENTER);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Live Tracking</h2>
          <p className="text-xs text-slate-500">
            {position.fromDevice
              ? `${DEVICE_ID} · ${formatCoord(position.latitude)}, ${formatCoord(position.longitude)}`
              : "No GPS fix yet · showing Chennai demo coordinate"}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${gpsOk ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
          {gpsOk ? "GPS LOCK" : "DEMO POSITION"}
        </span>
      </div>
      <div className={className}>
        <MapContainer
          center={[position.latitude, position.longitude]}
          zoom={14}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Recenter lat={position.latitude} lng={position.longitude} />
          <Marker position={[position.latitude, position.longitude]}>
            <Popup>
              {deviceId}
              <br />
              {formatCoord(position.latitude)}, {formatCoord(position.longitude)}
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </section>
  );
}
