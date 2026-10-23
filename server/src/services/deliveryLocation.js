// Pure landmark resolution shared by checkout and its tests. The server owns
// the landmark name and coordinates; client coordinates are only a fallback
// when the landmark has no pin yet.
export function resolveLandmarkLocation({
  landmark,
  restaurantCampusId,
  deliveryDetail,
  deliveryLat,
  deliveryLng,
}) {
  if (
    !landmark ||
    !landmark.isActive ||
    landmark.campusId !== restaurantCampusId
  ) {
    return {
      error:
        "That drop-off point is not available for this restaurant's campus.",
    };
  }

  const detail =
    typeof deliveryDetail === "string" ? deliveryDetail.trim() || null : null;

  // Never mix a landmark latitude with a client longitude.
  const hasLandmarkCoords = landmark.lat != null && landmark.lng != null;
  const lat = hasLandmarkCoords ? landmark.lat : (deliveryLat ?? null);
  const lng = hasLandmarkCoords ? landmark.lng : (deliveryLng ?? null);

  if (lat == null || lng == null) {
    return {
      error:
        "This drop-off point has no map pin yet. Use your current location or choose another landmark.",
    };
  }

  return {
    location: {
      landmarkId: landmark.id,
      detail,
      address: [landmark.name, detail]
        .filter(Boolean)
        .join(" — ")
        .slice(0, 200),
      lat,
      lng,
    },
  };
}
