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
    // 起點三角形用 inline SVG，唔好用 CSS background-image：
    // Chrome／Edge 列印或另存 PDF 時預設唔印背景圖，三角形會整塊消失（變白）。
    // inline SVG 屬前景內容，就算「背景圖形」關閉都照樣印得出。
    return L.divIcon({
      className: "course-icon",
      html: `<svg class="course-start" viewBox="0 0 24 22" width="28" height="26" preserveAspectRatio="xMidYMid meet" role="img" aria-label="起點" focusable="false"><path d="M12 2 L22 20 H2 Z" fill="none" stroke="#d00070" stroke-width="2.4" stroke-linejoin="round"/></svg>`,
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
      // 起點／CP／終點要壓過方格數字（zIndexOffset 100）同其他標記，永遠喺最頂層。
      zIndexOffset: 1000,
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
