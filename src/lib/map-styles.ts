/**
 * Muted “listing map” style (Google Maps only).
 * Hides POI clutter so price pins stay readable — similar to Airbnb/explore maps.
 */
export const GLAMMZO_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#F2F2F2" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#737373" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#F2F2F2" }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#E5E5E5" }],
  },
  {
    featureType: "administrative.land_parcel",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#E6E9E4" }, { visibility: "on" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#E5E5E5" }],
  },
  {
    featureType: "road",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#FAFAFA" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#D4D4D4" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#DDE3E8" }],
  },
] as Array<{
  elementType?: string
  featureType?: string
  stylers: Array<Record<string, string>>
}>
