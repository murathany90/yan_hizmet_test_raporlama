import { minMaxDownsample, visibleSlice } from "./downsample.js";
import { normalizeSeries, seriesSetsFor } from "./series.js";
import { safeFilename } from "../utils/text.js";

const COLORS = ["#005b9f", "#c43c3c", "#16875c", "#b16e00", "#7550a0", "#0d8f9d", "#7b8790", "#c66b1c"];

function extent(rows, key) {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    const value = row[key];
    if (!Number.isFinite(value)) continue;
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  return Number.isFinite(minimum) ? [minimum, maximum] : [0, 1];
}

function paddedExtent(rows, series) {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (const item of series) {
    const [localMinimum, localMaximum] = extent(rows, item.key);
    minimum = Math.min(minimum, localMinimum);
    maximum = Math.max(maximum, localMaximum);
  }
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return [0, 1];
  if (minimum === maximum) return [minimum - 1, maximum + 1];
  const padding = (maximum - minimum) * 0.08;
  return [minimum - padding, maximum + padding];
}

function formatAxis(value) {
  if (!Number.isFinite(value)) return "—";
  const absolute = Math.abs(value);
  if (absolute >= 1_000) return value.toFixed(0);
  if (absolute >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function usesRealTime(rows, options = {}) { return options.xMode !== "RELATIVE_SECONDS" && options.xMode !== "VALUE" && !options.xKey && rows.some((row) => Number.isFinite(row.timestamp_ms)); }
function xValue(row, options = {}) {
  if (options.xKey) return row[options.xKey];
  if (options.xMode === "RELATIVE_SECONDS" || options.xMode === "VALUE") return row.time_s;
  return Number.isFinite(row.timestamp_ms) ? row.timestamp_ms : row.time_s;
}
function xKey(rows, options = {}) { return options.xKey ?? (usesRealTime(rows, options) ? "timestamp_ms" : "time_s"); }
function formatTimeAxis(value, span, realTime) {
  if (!realTime) return formatAxis(value);
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "—";
  const showDate = span >= 20 * 60 * 60 * 1000;
  const showMs = span <= 15 * 60 * 1000;
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}${showMs ? `.${String(date.getMilliseconds()).padStart(3, "0")}` : ""}`;
  return showDate ? `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")} ${time}` : time;
}
function dateInputValue(value) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.valueOf() - offset).toISOString().slice(0, 23);
}

export function chartExtent(rows, options = {}) {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    const value = xValue(row, options);
    if (!Number.isFinite(value)) continue;
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return [0, 1];
  return minimum === maximum ? [minimum, minimum + 1] : [minimum, maximum];
}

export function chartViewForRows(rows, options = {}) {
  const [minimum, maximum] = chartExtent(rows, options);
  return { minimum, maximum, fullMin: minimum, fullMax: maximum };
}

function viewFor(state, viewKey, rows, options = {}) {
  const { minimum: fullMin, maximum: fullMax } = chartViewForRows(rows, options);
  const existing = state.chartViews.get(viewKey);
  const view = existing ?? { minimum: fullMin, maximum: fullMax, fullMin, fullMax };
  view.fullMin = fullMin;
  view.fullMax = fullMax;
  view.minimum = Math.max(fullMin, Math.min(view.minimum, fullMax));
  view.maximum = Math.min(fullMax, Math.max(view.maximum, fullMin));
  if (view.maximum <= view.minimum) {
    view.minimum = fullMin;
    view.maximum = fullMax;
  }
  state.chartViews.set(viewKey, view);
  return view;
}

function isSortedByX(rows, options = {}) {
  let previous = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    const value = xValue(row, options);
    if (!Number.isFinite(value)) continue;
    if (value < previous) return false;
    previous = value;
  }
  return true;
}

function dataForView(rows, series, view, maxPoints, options = {}) {
  const visible = isSortedByX(rows, options)
    ? visibleSlice(rows, view.minimum, view.maximum, xKey(rows, options))
    : rows.filter((row) => {
      const value = xValue(row, options);
      return Number.isFinite(value) && value >= view.minimum && value <= view.maximum;
    });
  return minMaxDownsample(visible, series.map((item) => item.key), maxPoints);
}

function renderType(item, options = {}) {
  return item.renderType ?? (options.chartType === "scatter" ? "points" : "line");
}

function rowsForSeries(data, item, options = {}) {
  const rows = data.filter((row) => Number.isFinite(xValue(row, options)) && Number.isFinite(row[item.key]));
  return options.xMode === "VALUE" && renderType(item, options) !== "points"
    ? [...rows].sort((left, right) => xValue(left, options) - xValue(right, options))
    : rows;
}

export function drawChart(canvas, rows, series, view, options = {}) {
  const cssWidth = options.width ?? canvas.clientWidth ?? 1100;
  const cssHeight = options.height ?? canvas.clientHeight ?? 400;
  if (cssWidth < 20 || cssHeight < 20) return;
  const pixelRatio = options.pixelRatio ?? Math.min(globalThis.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(cssWidth * pixelRatio));
  const height = Math.max(1, Math.round(cssHeight * pixelRatio));
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  const data = dataForView(rows, series, view, options.maxPoints ?? 4_000, options);
  const realTime = usesRealTime(rows, options);
  if (!data.length || !series.length) {
    context.fillStyle = "#526a7a";
    context.font = `${12 * pixelRatio}px Arial`;
    context.textAlign = "center";
    context.fillText("Gösterilecek seri seçilmedi.", width / 2, height / 2);
    return;
  }
  const leftSeries = series.filter((item) => item.axis !== "right");
  const rightSeries = series.filter((item) => item.axis === "right");
  const [leftMin, leftMax] = paddedExtent(data, leftSeries);
  const [rightMin, rightMax] = paddedExtent(data, rightSeries);
  const marginLeft = 70 * pixelRatio;
  const marginRight = (rightSeries.length ? 70 : 24) * pixelRatio;
  const marginTop = 24 * pixelRatio;
  const marginBottom = 46 * pixelRatio;
  const plotWidth = width - marginLeft - marginRight;
  const plotHeight = height - marginTop - marginBottom;
  const x = (value) => marginLeft + ((value - view.minimum) / (view.maximum - view.minimum || 1)) * plotWidth;
  const yLeft = (value) => height - marginBottom - ((value - leftMin) / (leftMax - leftMin || 1)) * plotHeight;
  const yRight = (value) => height - marginBottom - ((value - rightMin) / (rightMax - rightMin || 1)) * plotHeight;

  context.font = `${10 * pixelRatio}px Arial`;
  context.textBaseline = "middle";
  for (let index = 0; index <= 5; index += 1) {
    const y = marginTop + (index * plotHeight) / 5;
    context.strokeStyle = "#dce5ea";
    context.lineWidth = pixelRatio;
    context.beginPath();
    context.moveTo(marginLeft, y);
    context.lineTo(width - marginRight, y);
    context.stroke();
    context.fillStyle = "#526a7a";
    context.textAlign = "right";
    context.fillText(formatAxis(leftMax - ((leftMax - leftMin) * index) / 5), marginLeft - 8 * pixelRatio, y);
    if (rightSeries.length) {
      context.textAlign = "left";
      context.fillText(formatAxis(rightMax - ((rightMax - rightMin) * index) / 5), width - marginRight + 8 * pixelRatio, y);
    }
  }

  for (let index = 0; index <= 5; index += 1) {
    const value = view.minimum + ((view.maximum - view.minimum) * index) / 5;
    const position = x(value);
    context.fillStyle = "#526a7a";
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillText(formatTimeAxis(value, view.maximum - view.minimum, realTime), position, height - marginBottom + 9 * pixelRatio);
  }

  series.forEach((item, index) => {
    context.save();
    context.strokeStyle = item.color ?? COLORS[index % COLORS.length];
    context.fillStyle = item.color ?? COLORS[index % COLORS.length];
    context.lineWidth = 1.65 * pixelRatio;
    context.setLineDash(item.lineStyle === "dashed" || /Referans|Simüle/.test(item.label) ? [6 * pixelRatio, 4 * pixelRatio] : []);
    context.beginPath();
    let started = false;
    const type = renderType(item, options);
    for (const row of rowsForSeries(data, item, options)) {
      const rowX = xValue(row, options);
      const yValue = row[item.key];
      const px = x(rowX);
      const py = (item.axis === "right" ? yRight : yLeft)(yValue);
      if (type === "points") {
        context.moveTo(px + 1.5 * pixelRatio, py);
        context.arc(px, py, 1.5 * pixelRatio, 0, Math.PI * 2);
        started = true;
      } else if (!started) {
        context.moveTo(px, py);
        started = true;
      } else context.lineTo(px, py);
    }
    if (type === "points") context.fill();
    else context.stroke();
    context.restore();
  });

  for (const marker of options.markers ?? []) {
    if (!Number.isFinite(marker?.value) || marker.value < view.minimum || marker.value > view.maximum) continue;
    const position = x(marker.value);
    context.save();
    context.strokeStyle = "#6d7780";
    context.lineWidth = pixelRatio;
    context.setLineDash([3 * pixelRatio, 3 * pixelRatio]);
    context.beginPath();
    context.moveTo(position, marginTop);
    context.lineTo(position, height - marginBottom);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = "#465660";
    context.font = `${9 * pixelRatio}px Arial`;
    context.textAlign = "center";
    context.textBaseline = "bottom";
    context.fillText(marker.label, position, marginTop - 3 * pixelRatio);
    context.restore();
  }

  context.fillStyle = "#314f61";
  context.font = `${10 * pixelRatio}px Arial`;
  context.textAlign = "center";
  context.textBaseline = "bottom";
  context.fillText(realTime ? "Gerçek zaman" : options.xMode === "VALUE" ? "Frekans [Hz]" : "Zaman [s]", marginLeft + plotWidth / 2, height - 2 * pixelRatio);
  context.save();
  context.translate(12 * pixelRatio, marginTop + plotHeight / 2);
  context.rotate(-Math.PI / 2);
  context.fillText([...new Set(leftSeries.map((item) => item.unit))].join(" / ") || "Değer", 0, 0);
  context.restore();
  if (rightSeries.length) {
    context.save();
    context.translate(width - 10 * pixelRatio, marginTop + plotHeight / 2);
    context.rotate(Math.PI / 2);
    context.fillText([...new Set(rightSeries.map((item) => item.unit))].join(" / "), 0, 0);
    context.restore();
  }
}

function svgEscape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function chartToSvg(rows, series, view, title, width = 1200, height = 600, options = {}) {
  const data = dataForView(rows, series, view, 6_000, options);
  const leftSeries = series.filter((item) => item.axis !== "right");
  const rightSeries = series.filter((item) => item.axis === "right");
  const [leftMin, leftMax] = paddedExtent(data, leftSeries);
  const [rightMin, rightMax] = paddedExtent(data, rightSeries);
  const left = 78;
  const right = rightSeries.length ? 78 : 28;
  const top = 50;
  const bottom = 58;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const x = (value) => left + ((value - view.minimum) / (view.maximum - view.minimum || 1)) * plotWidth;
  const yLeft = (value) => height - bottom - ((value - leftMin) / (leftMax - leftMin || 1)) * plotHeight;
  const yRight = (value) => height - bottom - ((value - rightMin) / (rightMax - rightMin || 1)) * plotHeight;
  const grid = Array.from({ length: 6 }, (_, index) => {
    const y = top + (index * plotHeight) / 5;
    return `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="#dce5ea"/><text x="${left - 8}" y="${y + 4}" text-anchor="end">${formatAxis(leftMax - ((leftMax - leftMin) * index) / 5)}</text>`;
  }).join("");
  const realTime = usesRealTime(rows, options);
  const paths = series.map((item, index) => {
    const seriesRows = rowsForSeries(data, item, options);
    const points = seriesRows.map((row) => `${x(xValue(row, options)).toFixed(2)},${(item.axis === "right" ? yRight : yLeft)(row[item.key]).toFixed(2)}`).join(" ");
    const color = item.color ?? COLORS[index % COLORS.length];
    return renderType(item, options) === "points"
      ? seriesRows.map((row) => `<circle cx="${x(xValue(row, options)).toFixed(2)}" cy="${(item.axis === "right" ? yRight : yLeft)(row[item.key]).toFixed(2)}" r="1.5" fill="${color}"/>`).join("")
      : `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"${item.lineStyle === "dashed" ? ' stroke-dasharray="7 5"' : ""}/>`;
  }).join("");
  const legend = series.map((item, index) => `<text x="${left + index * 190}" y="${height - 14}" fill="${item.color ?? COLORS[index % COLORS.length]}">${svgEscape(item.label)} [${svgEscape(item.unit)}]</text>`).join("");
  const labels = Array.from({ length: 6 }, (_, index) => `<text x="${x(view.minimum + ((view.maximum - view.minimum) * index) / 5)}" y="${height - 42}" text-anchor="middle">${svgEscape(formatTimeAxis(view.minimum + ((view.maximum - view.minimum) * index) / 5, view.maximum - view.minimum, realTime))}</text>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fff"/><g font-family="Arial" font-size="12" fill="#526a7a"><text x="${width / 2}" y="24" text-anchor="middle" font-size="16" font-weight="700" fill="#244b64">${svgEscape(title)}</text>${grid}${paths}${labels}<text x="${left + plotWidth / 2}" y="${height - 18}" text-anchor="middle">${realTime ? "Gerçek zaman" : options.xMode === "VALUE" ? "Frekans [Hz]" : "Zaman [s]"}</text>${legend}</g></svg>`;
}

function button(label, action, title = label) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "button ghost small";
  element.dataset.chartAction = action;
  element.textContent = label;
  element.title = title;
  return element;
}

export class ChartManager {
  constructor(state, onDownload) {
    this.state = state;
    this.onDownload = onDownload;
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const canvas = entry.target.querySelector?.("canvas");
        if (canvas?.dataset.viewKey) this.scheduleDraw(canvas.dataset.viewKey);
      }
    });
    this.registry = new Map();
    this.frames = new Map();
  }

  dispose() {
    this.resizeObserver.disconnect();
    for (const frame of this.frames.values()) cancelAnimationFrame(frame);
    this.frames.clear();
    this.registry.clear();
  }

  scheduleDraw(viewKey) {
    const existing = this.frames.get(viewKey);
    if (existing) cancelAnimationFrame(existing);
    this.frames.set(viewKey, requestAnimationFrame(() => {
      this.frames.delete(viewKey);
      const entry = this.registry.get(viewKey);
      if (!entry || !entry.details.open) return;
      drawChart(entry.canvas, entry.rows, this.visibleSeries(viewKey, entry.series), viewFor(this.state, viewKey, entry.rows, entry.options), entry.options);
      const view = this.state.chartViews.get(viewKey);
      entry.minimumInput.value = entry.realTime ? dateInputValue(view.minimum) : String(view.minimum);
      entry.maximumInput.value = entry.realTime ? dateInputValue(view.maximum) : String(view.maximum);
    }));
  }

  visibleSeries(viewKey, series) {
    return series.filter((item) => this.state.chartSeriesVisibility.get(`${viewKey}:${item.key}`) !== false);
  }

  render(container, record, service, modeKey, append = false) {
    if (!append) {
      this.resizeObserver.disconnect();
      this.registry.clear();
      container.replaceChildren();
      this.lastFigureGroup = null;
    }
    const sets = record.seriesSets ?? seriesSetsFor(record, service);
    sets.forEach((set, index) => {
      if (set.figureGroup && this.lastFigureGroup !== set.figureGroup) {
        const heading = document.createElement("h3");
        heading.className = "chart-figure-group";
        heading.textContent = set.groupTitle ?? set.title;
        container.append(heading);
      }
      this.lastFigureGroup = set.figureGroup ?? null;
      const viewKey = `${modeKey}:${record.step.id}:${record.eventAnalysis?.eventId ?? "record"}:${index}`;
      const rows = set.rows ?? record.rows;
      const series = normalizeSeries(set.series);
      const options = { xMode: set.xMode, xKey: set.xKey, chartType: set.chartType, markers: set.markers };
      const view = viewFor(this.state, viewKey, rows, options);
      const realTime = usesRealTime(rows, options);
      if (!this.state.chartOpenState.has(viewKey)) this.state.chartOpenState.set(viewKey, true);

      const details = document.createElement("details");
      details.className = "chart-details";
      details.open = this.state.chartOpenState.get(viewKey);
      const summary = document.createElement("summary");
      summary.textContent = set.title;
      const inner = document.createElement("div");
      inner.className = "chart-inner";
      const toolbar = document.createElement("div");
      toolbar.className = "chart-toolbar";
      toolbar.append(button("Zoom +", "zoom-in", "Seçili zaman aralığını yakınlaştır"), button("Zoom -", "zoom-out", "Seçili zaman aralığını uzaklaştır"), button("Reset", "reset", "Tam zaman aralığına dön"), button("PNG indir", "png", "Grafiği PNG olarak kaydet"), button("SVG indir", "svg", "Grafiği vektörel SVG olarak kaydet"));
      const range = document.createElement("div");
      range.className = "chart-range";
      const minimumInput = document.createElement("input");
      minimumInput.type = realTime ? "datetime-local" : "number";
      minimumInput.step = realTime ? "0.001" : "any";
      minimumInput.value = realTime ? dateInputValue(view.minimum) : String(view.minimum);
      const valueAxis = options.xMode === "VALUE";
      minimumInput.setAttribute("aria-label", realTime ? "Başlangıç gerçek zamanı" : valueAxis ? "Minimum frekans Hz" : "Başlangıç zamanı saniye");
      const separator = document.createElement("span");
      separator.textContent = realTime || valueAxis ? "—" : "s —";
      const maximumInput = document.createElement("input");
      maximumInput.type = realTime ? "datetime-local" : "number";
      maximumInput.step = realTime ? "0.001" : "any";
      maximumInput.value = realTime ? dateInputValue(view.maximum) : String(view.maximum);
      maximumInput.setAttribute("aria-label", realTime ? "Bitiş gerçek zamanı" : valueAxis ? "Maksimum frekans Hz" : "Bitiş zamanı saniye");
      const unit = document.createElement("span");
      unit.textContent = realTime ? "" : valueAxis ? "Hz" : "s";
      range.append(minimumInput, separator, maximumInput, unit, button("Uygula", "apply-range", "Girilen zaman aralığını uygula"));
      toolbar.append(range);
      if (set.annotation) toolbar.append(Object.assign(document.createElement("span"), { className: "chart-annotation", textContent: set.annotation }));
      const canvas = document.createElement("canvas");
      canvas.className = "chart-canvas";
      canvas.dataset.viewKey = viewKey;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `${set.title} zaman serisi grafiği`);
      const tooltip = document.createElement("div");
      tooltip.className = "chart-tooltip";
      tooltip.hidden = true;
      const legend = document.createElement("div");
      legend.className = "legend";
      series.forEach((item, seriesIndex) => {
        const seriesKey = `${viewKey}:${item.key}`;
        if (!this.state.chartSeriesVisibility.has(seriesKey)) this.state.chartSeriesVisibility.set(seriesKey, true);
        const legendItem = document.createElement("button");
        legendItem.type = "button";
        legendItem.className = "legend-item";
        legendItem.style.setProperty("--series-color", item.color ?? COLORS[seriesIndex % COLORS.length]);
        legendItem.textContent = `${item.label} [${item.unit}]`;
        legendItem.dataset.seriesKey = seriesKey;
        legendItem.setAttribute("aria-pressed", String(this.state.chartSeriesVisibility.get(seriesKey) !== false));
        legendItem.title = "Seriyi göster/gizle";
        legendItem.addEventListener("click", () => {
          const visible = this.state.chartSeriesVisibility.get(seriesKey) !== false;
          this.state.chartSeriesVisibility.set(seriesKey, !visible);
          legendItem.classList.toggle("hidden", visible);
          legendItem.setAttribute("aria-pressed", String(!visible));
          this.scheduleDraw(viewKey);
        });
        legend.append(legendItem);
      });
      inner.append(toolbar, canvas, tooltip, legend);
      details.append(summary, inner);
      container.append(details);

      const registryEntry = { details, canvas, record, rows, series, title: set.title, minimumInput, maximumInput, realTime, options };
      this.registry.set(viewKey, registryEntry);
      this.resizeObserver.observe(inner);
      details.addEventListener("toggle", () => {
        this.state.chartOpenState.set(viewKey, details.open);
        if (details.open) this.scheduleDraw(viewKey);
      });
      toolbar.addEventListener("click", async (event) => {
        const action = event.target.closest("button")?.dataset.chartAction;
        if (!action) return;
        const currentView = viewFor(this.state, viewKey, rows, options);
        if (action === "zoom-in" || action === "zoom-out") {
          const factor = action === "zoom-in" ? 0.65 : 1.55;
          this.adjustView(currentView, factor, 0.5);
          this.scheduleDraw(viewKey);
        } else if (action === "reset") {
          currentView.minimum = currentView.fullMin;
          currentView.maximum = currentView.fullMax;
          this.scheduleDraw(viewKey);
        } else if (action === "apply-range") {
          const minimum = realTime ? new Date(minimumInput.value).valueOf() : Number(minimumInput.value);
          const maximum = realTime ? new Date(maximumInput.value).valueOf() : Number(maximumInput.value);
          if (Number.isFinite(minimum) && Number.isFinite(maximum) && maximum > minimum) {
            currentView.minimum = Math.max(currentView.fullMin, minimum);
            currentView.maximum = Math.min(currentView.fullMax, maximum);
            this.scheduleDraw(viewKey);
          }
        } else if (action === "png") {
          canvas.toBlob((blob) => blob && this.onDownload(blob, `${safeFilename(record.name)}-${index + 1}.png`), "image/png");
        } else if (action === "svg") {
          const svg = chartToSvg(rows, this.visibleSeries(viewKey, series), currentView, set.title, 1200, 600, options);
          await this.onDownload(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `${safeFilename(record.name)}-${index + 1}.svg`);
        }
      });

      canvas.addEventListener("wheel", (event) => {
        event.preventDefault();
        const rectangle = canvas.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (event.clientX - rectangle.left) / rectangle.width));
        this.adjustView(viewFor(this.state, viewKey, rows, options), event.deltaY < 0 ? 0.65 : 1.55, ratio);
        this.scheduleDraw(viewKey);
      }, { passive: false });

      canvas.addEventListener("pointermove", (event) => {
        const rectangle = canvas.getBoundingClientRect();
        const currentView = viewFor(this.state, viewKey, rows, options);
        const target = currentView.minimum + ((event.clientX - rectangle.left) / rectangle.width) * (currentView.maximum - currentView.minimum);
        let nearest = null;
        for (const row of rows) {
          if (!Number.isFinite(xValue(row, options))) continue;
          if (!nearest || Math.abs(xValue(row, options) - target) < Math.abs(xValue(nearest, options) - target)) nearest = row;
        }
        if (!nearest) return;
        const values = this.visibleSeries(viewKey, series).filter((item) => Number.isFinite(nearest[item.key])).map((item) => `${item.label}: ${formatAxis(nearest[item.key])} ${item.unit}`);
        tooltip.textContent = `${options.xMode === "VALUE" ? "Frekans" : "Zaman"}: ${options.xMode === "VALUE" ? formatAxis(xValue(nearest, options)) : nearest.zaman || formatTimeAxis(xValue(nearest, options), currentView.maximum - currentView.minimum, realTime)}\nSıra No: ${nearest.sira_no ?? "—"}${values.length ? `\n${values.join("\n")}` : ""}`;
        tooltip.hidden = false;
      });
      canvas.addEventListener("pointerleave", () => { tooltip.hidden = true; });

      let dragging = false;
      let startX = 0;
      let startMinimum = 0;
      let startMaximum = 0;
      canvas.addEventListener("pointerdown", (event) => {
        dragging = true;
        startX = event.clientX;
        const currentView = viewFor(this.state, viewKey, rows, options);
        startMinimum = currentView.minimum;
        startMaximum = currentView.maximum;
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = "grabbing";
      });
      canvas.addEventListener("pointermove", (event) => {
        if (!dragging) return;
        const currentView = viewFor(this.state, viewKey, rows, options);
        const span = startMaximum - startMinimum;
        let minimum = startMinimum - ((event.clientX - startX) / canvas.getBoundingClientRect().width) * span;
        let maximum = minimum + span;
        if (minimum < currentView.fullMin) {
          maximum += currentView.fullMin - minimum;
          minimum = currentView.fullMin;
        }
        if (maximum > currentView.fullMax) {
          minimum -= maximum - currentView.fullMax;
          maximum = currentView.fullMax;
        }
        currentView.minimum = minimum;
        currentView.maximum = maximum;
        this.scheduleDraw(viewKey);
      });
      const stopDrag = () => {
        dragging = false;
        canvas.style.cursor = "crosshair";
      };
      canvas.addEventListener("pointerup", stopDrag);
      canvas.addEventListener("pointercancel", stopDrag);
      canvas.addEventListener("pointerleave", stopDrag);
      canvas.style.cursor = "crosshair";
      this.scheduleDraw(viewKey);
    });
  }

  adjustView(view, factor, ratio) {
    const fullSpan = view.fullMax - view.fullMin;
    const span = view.maximum - view.minimum;
    const minimumSpan = Math.max(fullSpan / 20_000, 0.001);
    const nextSpan = Math.max(minimumSpan, Math.min(fullSpan, span * factor));
    const center = view.minimum + ratio * span;
    let minimum = center - ratio * nextSpan;
    let maximum = minimum + nextSpan;
    if (minimum < view.fullMin) {
      maximum += view.fullMin - minimum;
      minimum = view.fullMin;
    }
    if (maximum > view.fullMax) {
      minimum -= maximum - view.fullMax;
      maximum = view.fullMax;
    }
    view.minimum = Math.max(view.fullMin, minimum);
    view.maximum = Math.min(view.fullMax, maximum);
  }

  renderRecordImages(record, service) {
    return (record.seriesSets ?? seriesSetsFor(record, service)).map((set) => {
      const series = normalizeSeries(set.series);
      const rows = set.rows ?? record.rows;
      const options = { xMode: set.xMode, xKey: set.xKey, chartType: set.chartType, markers: set.markers };
      const view = chartViewForRows(rows, options);
      const canvas = document.createElement("canvas");
      drawChart(canvas, rows, series, view, { ...options, width: 1100, height: 400, pixelRatio: 1, maxPoints: 6_000 });
      return { title: set.title, annotation: set.annotation ?? "", figureGroup: set.figureGroup ?? "", groupTitle: set.groupTitle ?? "", dataUrl: canvas.toDataURL("image/png") };
    });
  }
}
