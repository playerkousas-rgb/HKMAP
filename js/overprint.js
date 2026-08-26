/** 城市定向路線套印，供策劃者列印紙圖。 */
export const MAGENTA = "#d00070";

export function orderedControls(controls) {
  const list = controls || [];
  return [
    ...list.filter((c) => c.kind === "start"),
    ...list.filter((c) => c.kind === "control"),
    ...list.filter((c) => c.kind === "finish"),
  ];
}

export function controlIcon(ctrl, index) {
  if (ctrl.kind === "start") {
    return L.divIcon({
      className: "course-icon",
      html: `<div class="course-start" title="起點"></div>`,
      iconSize: [28, 26],
      iconAnchor: [14, 18],
    });
  }
  if (ctrl.kind === "finish") {
    return L.divIcon({
      className: "course-icon",
      html: `<div class="course-finish" title="終點"></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
  }
  return L.divIcon({
    className: "course-icon",
    html: `<div class="course-control"><span class="ring"></span><span class="lab">${ctrl.code || index}</span></div>`,
    iconSize: [56, 36],
    iconAnchor: [16, 18],
  });
}

export function drawOverprint(layer, controls, options = {}) {
  layer.clearLayers();
  const list = orderedControls(controls);
  if (options.lines !== false && list.length >= 2) {
    L.polyline(
      list.map((c) => [c.lat, c.lng]),
      {
        color: MAGENTA,
        weight: options.weight || 3,
        opacity: 0.95,
        lineJoin: "round",
        interactive: false,
      }
    ).addTo(layer);
  }
  list.forEach((ctrl, i) => {
    const marker = L.marker([ctrl.lat, ctrl.lng], {
      draggable: Boolean(options.draggable),
      icon: controlIcon(ctrl, i),
      riseOnHover: true,
      keyboard: false,
    }).addTo(layer);
    if (options.onDragStart) {
      marker.on("dragstart", () => options.onDragStart(ctrl));
    }
    if (options.onDrag) {
      marker.on("dragend", () => options.onDrag(ctrl, marker.getLatLng()));
    }
    if (options.onClick) {
      marker.on("click", (ev) => {
        L.DomEvent.stopPropagation(ev);
        options.onClick(ctrl);
      });
    }
  });
  return list;
}
