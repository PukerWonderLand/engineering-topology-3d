export type GlobalLabelSide = "left" | "right";
export type GlobalLabelLayoutMode = "module" | "camera";

export interface GlobalLabelObstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProjectedGlobalModuleLabel {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  color: string;
  side: GlobalLabelSide;
  anchorX: number;
  anchorY: number;
  cameraDistance: number;
  visibility: number;
  muted: boolean;
}

export interface GlobalModuleLabelLayout extends ProjectedGlobalModuleLabel {
  x: number;
  y: number;
  width: number;
  height: number;
  column: number;
}

interface GlobalLabelMetrics {
  cardWidth: number;
  cardHeight: number;
  gap: number;
  margin: number;
  safeTop: number;
  safeBottom: number;
}

interface ModuleLabelCandidate {
  x: number;
  y: number;
  side: GlobalLabelSide;
  column: number;
  score: number;
}

function clampNumber(value: number, minimum: number, maximum: number) {
  if (maximum < minimum) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function globalLabelMetrics(width: number, height: number, moduleLabelScale: number): GlobalLabelMetrics {
  const base = width >= 1400 && height >= 720
    ? { cardWidth: 220, cardHeight: 52, gap: 8, margin: 24, safeTop: 66, safeBottom: 72 }
    : width <= 720
      ? { cardWidth: 132, cardHeight: 40, gap: 5, margin: 8, safeTop: 48, safeBottom: 44 }
      : { cardWidth: 174, cardHeight: 46, gap: 7, margin: 14, safeTop: 56, safeBottom: 58 };
  const scale = clampNumber(moduleLabelScale, 0.6, 1.6);
  return {
    cardWidth: Math.round(base.cardWidth * scale),
    cardHeight: Math.round(base.cardHeight * scale),
    gap: Math.max(4, Math.round(base.gap * Math.max(0.8, Math.sqrt(scale)))),
    margin: base.margin,
    safeTop: base.safeTop,
    safeBottom: base.safeBottom,
  };
}

function rectanglesOverlap(
  first: Pick<GlobalModuleLabelLayout, "x" | "y" | "width" | "height">,
  second: Pick<GlobalModuleLabelLayout, "x" | "y" | "width" | "height">,
) {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y;
}

function hasAnyOverlap(layouts: GlobalModuleLabelLayout[], obstacles: GlobalLabelObstacle[]) {
  for (let first = 0; first < layouts.length; first += 1) {
    if (obstacles.some((obstacle) => rectanglesOverlap(layouts[first], obstacle))) return true;
    for (let second = first + 1; second < layouts.length; second += 1) {
      if (rectanglesOverlap(layouts[first], layouts[second])) return true;
    }
  }
  return false;
}

function verticalSlotsForColumn(
  x: number,
  top: number,
  bottom: number,
  metrics: GlobalLabelMetrics,
  obstacles: GlobalLabelObstacle[],
) {
  const blocked = obstacles
    .filter((obstacle) => obstacle.x < x + metrics.cardWidth + metrics.gap
      && obstacle.x + obstacle.width > x - metrics.gap)
    .map((obstacle) => ({
      start: clampNumber(obstacle.y - metrics.gap, top, bottom),
      end: clampNumber(obstacle.y + obstacle.height + metrics.gap, top, bottom),
    }))
    .filter((interval) => interval.end > interval.start)
    .toSorted((first, second) => first.start - second.start);

  const merged: { start: number; end: number }[] = [];
  blocked.forEach((interval) => {
    const previous = merged[merged.length - 1];
    if (previous && interval.start <= previous.end) previous.end = Math.max(previous.end, interval.end);
    else merged.push({ ...interval });
  });

  const segments: { start: number; end: number }[] = [];
  let cursor = top;
  merged.forEach((interval) => {
    if (interval.start > cursor) segments.push({ start: cursor, end: interval.start });
    cursor = Math.max(cursor, interval.end);
  });
  if (cursor < bottom) segments.push({ start: cursor, end: bottom });

  const slots: number[] = [];
  segments.forEach((segment) => {
    for (let y = segment.start; y + metrics.cardHeight <= segment.end + 0.01; y += metrics.cardHeight + metrics.gap) {
      slots.push(Math.round(y * 2) / 2);
    }
  });
  return slots;
}

function assignLabelsToSlots(labels: ProjectedGlobalModuleLabel[], slots: number[], cardHeight: number) {
  if (slots.length < labels.length) return null;
  const assigned: number[] = [];
  let firstAvailable = 0;
  labels.forEach((label, labelIndex) => {
    const lastAllowed = slots.length - (labels.length - labelIndex);
    let bestIndex = firstAvailable;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let slotIndex = firstAvailable; slotIndex <= lastAllowed; slotIndex += 1) {
      const distance = Math.abs(slots[slotIndex] - (label.anchorY - cardHeight / 2));
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = slotIndex;
      }
    }
    assigned.push(slots[bestIndex]);
    firstAvailable = bestIndex + 1;
  });
  return assigned;
}

function distributeLabels(labels: ProjectedGlobalModuleLabel[], columnCount: number) {
  const columns = Array.from({ length: columnCount }, () => [] as ProjectedGlobalModuleLabel[]);
  labels.forEach((label, index) => {
    columns[index % columnCount].push(label);
  });
  return columns;
}

function tryCameraLayoutSide(
  labels: ProjectedGlobalModuleLabel[],
  side: GlobalLabelSide,
  viewportWidth: number,
  viewportHeight: number,
  moduleLabelDistance: number,
  metrics: GlobalLabelMetrics,
  obstacles: GlobalLabelObstacle[],
) {
  if (labels.length === 0) return [] as GlobalModuleLabelLayout[];
  const top = metrics.safeTop;
  const bottom = Math.max(top + metrics.cardHeight, viewportHeight - metrics.safeBottom);
  const step = metrics.cardWidth + metrics.gap;
  const maximumX = viewportWidth - metrics.margin - metrics.cardWidth;
  const centerGap = metrics.gap / 2;
  const minimumSideX = side === "right" ? viewportWidth / 2 + centerGap : metrics.margin;
  const maximumSideX = side === "left" ? viewportWidth / 2 - centerGap - metrics.cardWidth : maximumX;
  if (maximumSideX < minimumSideX) return null;

  const edgeInset = metrics.margin + (2.4 - moduleLabelDistance) * 24;
  const idealX = side === "left" ? edgeInset : viewportWidth - edgeInset - metrics.cardWidth;
  const startX = clampNumber(idealX, minimumSideX, maximumSideX);
  const maximumCandidateCount = Math.max(1, Math.ceil((maximumSideX - minimumSideX) / step) + 1);
  const candidateXs: number[] = [];
  const addCandidate = (x: number) => {
    const bounded = clampNumber(x, minimumSideX, maximumSideX);
    if (candidateXs.some((candidate) => Math.abs(candidate - bounded) < metrics.cardWidth + metrics.gap - 0.5)) return;
    candidateXs.push(Math.round(bounded * 2) / 2);
  };

  addCandidate(startX);
  for (let offset = 1; candidateXs.length < maximumCandidateCount && offset <= maximumCandidateCount; offset += 1) {
    addCandidate(startX + (side === "left" ? offset : -offset) * step);
  }

  const columns = candidateXs
    .map((x, rank) => ({ x, rank, slots: verticalSlotsForColumn(x, top, bottom, metrics, obstacles) }))
    .filter((column) => column.slots.length > 0);
  if (columns.reduce((capacity, column) => capacity + column.slots.length, 0) < labels.length) return null;

  const availableSlots = columns.flatMap((column) => column.slots.map((y) => ({
    x: column.x,
    y,
    column: column.rank,
  })));
  const layouts: GlobalModuleLabelLayout[] = [];
  labels.forEach((label) => {
    const idealY = label.anchorY - metrics.cardHeight / 2;
    let bestSlotIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    availableSlots.forEach((slot, slotIndex) => {
      const score = Math.abs(slot.y - idealY) + slot.column * Math.max(10, metrics.gap * 1.5);
      if (score < bestScore) {
        bestScore = score;
        bestSlotIndex = slotIndex;
      }
    });
    const [slot] = availableSlots.splice(bestSlotIndex, 1);
    layouts.push({
      ...label,
      x: slot.x,
      y: slot.y,
      width: metrics.cardWidth,
      height: metrics.cardHeight,
      column: slot.column,
    });
  });

  return layouts;
}

function moduleLabelCandidates(
  label: ProjectedGlobalModuleLabel,
  viewportWidth: number,
  viewportHeight: number,
  moduleLabelDistance: number,
  metrics: GlobalLabelMetrics,
  obstacles: GlobalLabelObstacle[],
) {
  const minimumX = metrics.margin;
  const maximumX = viewportWidth - metrics.margin - metrics.cardWidth;
  const minimumY = metrics.margin;
  const maximumY = viewportHeight - metrics.margin - metrics.cardHeight;
  if (maximumX < minimumX || maximumY < minimumY) return [] as ModuleLabelCandidate[];

  const moduleGap = 8 + moduleLabelDistance * 18;
  const horizontalStep = metrics.cardWidth + metrics.gap;
  const verticalStep = metrics.cardHeight + metrics.gap;
  const maximumColumns = Math.max(1, Math.ceil(viewportWidth / horizontalStep));
  const maximumRows = Math.max(1, Math.ceil(viewportHeight / verticalStep));
  const oppositeSide: GlobalLabelSide = label.side === "right" ? "left" : "right";
  const sideOrder: GlobalLabelSide[] = [label.side, oppositeSide];
  const candidates: ModuleLabelCandidate[] = [];
  const seen = new Set<string>();

  const addCandidate = (
    rawX: number,
    rawY: number,
    side: GlobalLabelSide,
    column: number,
    sideIndex: number,
  ) => {
    const x = Math.round(clampNumber(rawX, minimumX, maximumX) * 2) / 2;
    const y = Math.round(clampNumber(rawY, minimumY, maximumY) * 2) / 2;
    if (side === "right" && x < label.anchorX + Math.min(4, moduleGap)) return;
    if (side === "left" && x + metrics.cardWidth > label.anchorX - Math.min(4, moduleGap)) return;
    const key = `${x}:${y}:${side}`;
    if (seen.has(key)) return;
    seen.add(key);
    const rectangle = { x, y, width: metrics.cardWidth, height: metrics.cardHeight };
    if (obstacles.some((obstacle) => rectanglesOverlap(rectangle, obstacle))) return;
    const cardEdgeX = side === "right" ? x : x + metrics.cardWidth;
    const cardCenterY = y + metrics.cardHeight / 2;
    candidates.push({
      x,
      y,
      side,
      column: sideIndex * maximumColumns + column,
      score: Math.hypot(cardEdgeX - label.anchorX, cardCenterY - label.anchorY)
        + sideIndex * metrics.cardWidth * 0.28
        + column * metrics.gap,
    });
  };

  sideOrder.forEach((side, sideIndex) => {
    const direction = side === "right" ? 1 : -1;
    const firstX = side === "right"
      ? label.anchorX + moduleGap
      : label.anchorX - moduleGap - metrics.cardWidth;
    for (let column = 0; column < maximumColumns; column += 1) {
      const x = firstX + direction * column * horizontalStep;
      if (side === "right" && x > maximumX + 0.5) break;
      if (side === "left" && x < minimumX - 0.5) break;
      addCandidate(x, label.anchorY - metrics.cardHeight / 2, side, column, sideIndex);
      for (let row = 1; row <= maximumRows; row += 1) {
        addCandidate(x, label.anchorY - metrics.cardHeight / 2 - row * verticalStep, side, column, sideIndex);
        addCandidate(x, label.anchorY - metrics.cardHeight / 2 + row * verticalStep, side, column, sideIndex);
      }
    }
  });

  return candidates.toSorted((first, second) => first.score - second.score || first.column - second.column);
}

function resolveModuleNeighborhoodLayout(
  projectedLabels: ProjectedGlobalModuleLabel[],
  viewportWidth: number,
  viewportHeight: number,
  moduleLabelDistance: number,
  metrics: GlobalLabelMetrics,
  obstacles: GlobalLabelObstacle[],
) {
  const top = metrics.margin;
  const bottom = viewportHeight - metrics.margin;
  const orderedLabels = projectedLabels.toSorted((first, second) => {
    const firstBoundaryRoom = Math.min(first.anchorY - top, bottom - first.anchorY);
    const secondBoundaryRoom = Math.min(second.anchorY - top, bottom - second.anchorY);
    return firstBoundaryRoom - secondBoundaryRoom
      || first.anchorY - second.anchorY
      || first.cameraDistance - second.cameraDistance;
  });
  const layouts: GlobalModuleLabelLayout[] = [];

  for (const label of orderedLabels) {
    const candidate = moduleLabelCandidates(
      label,
      viewportWidth,
      viewportHeight,
      moduleLabelDistance,
      metrics,
      obstacles,
    ).find((position) => !layouts.some((layout) => rectanglesOverlap(
      { x: position.x, y: position.y, width: metrics.cardWidth, height: metrics.cardHeight },
      layout,
    )));
    if (!candidate) return [];
    layouts.push({
      ...label,
      side: candidate.side,
      x: candidate.x,
      y: candidate.y,
      width: metrics.cardWidth,
      height: metrics.cardHeight,
      column: candidate.column,
    });
  }

  return layouts;
}

function resolveViewportFallback(
  labels: ProjectedGlobalModuleLabel[],
  viewportWidth: number,
  viewportHeight: number,
  moduleLabelDistance: number,
  metrics: GlobalLabelMetrics,
  obstacles: GlobalLabelObstacle[],
) {
  const top = metrics.margin;
  const bottom = Math.max(top + metrics.cardHeight, viewportHeight - metrics.margin);
  const rawCapacity = Math.max(1, Math.floor((bottom - top + metrics.gap) / (metrics.cardHeight + metrics.gap)));
  const minimumColumns = Math.ceil(labels.length / rawCapacity);
  const maximumColumns = Math.max(1, Math.min(
    labels.length,
    Math.floor((viewportWidth - metrics.margin * 2 + metrics.gap) / (metrics.cardWidth + metrics.gap)),
  ));
  const sortedLabels = labels.toSorted((first, second) => first.anchorY - second.anchorY || first.cameraDistance - second.cameraDistance);

  for (let columnCount = minimumColumns; columnCount <= maximumColumns; columnCount += 1) {
    const columns = distributeLabels(sortedLabels, columnCount);
    const groupWidth = columnCount * metrics.cardWidth + Math.max(0, columnCount - 1) * metrics.gap;
    const largestStart = Math.max(metrics.margin, viewportWidth - metrics.margin - groupWidth);
    const groupStart = clampNumber(
      viewportWidth / 2 - groupWidth / 2 + (moduleLabelDistance - 1.5) * 18,
      metrics.margin,
      largestStart,
    );
    const layouts: GlobalModuleLabelLayout[] = [];
    let fits = true;
    columns.forEach((columnLabels, columnIndex) => {
      if (!fits || columnLabels.length === 0) return;
      const x = groupStart + columnIndex * (metrics.cardWidth + metrics.gap);
      const slots = verticalSlotsForColumn(x, top, bottom, metrics, obstacles);
      const yPositions = assignLabelsToSlots(columnLabels, slots, metrics.cardHeight);
      if (!yPositions) {
        fits = false;
        return;
      }
      columnLabels.forEach((label, index) => layouts.push({
        ...label,
        x: Math.round(x * 2) / 2,
        y: yPositions[index],
        width: metrics.cardWidth,
        height: metrics.cardHeight,
        column: columnIndex,
      }));
    });
    if (fits && layouts.length === labels.length && !hasAnyOverlap(layouts, obstacles)) return layouts;
  }
  return [];
}

export function resolveGlobalLabelCollisions(
  projectedLabels: ProjectedGlobalModuleLabel[],
  viewportWidth: number,
  viewportHeight: number,
  moduleLabelDistance: number,
  layoutMode: GlobalLabelLayoutMode,
  moduleLabelScale = 1,
  obstacles: GlobalLabelObstacle[] = [],
) {
  const metrics = globalLabelMetrics(viewportWidth, viewportHeight, moduleLabelScale);
  if (layoutMode === "module") {
    return resolveModuleNeighborhoodLayout(
      projectedLabels,
      viewportWidth,
      viewportHeight,
      moduleLabelDistance,
      metrics,
      obstacles,
    );
  }
  const layouts: GlobalModuleLabelLayout[] = [];
  let sideLayoutFailed = false;

  (["left", "right"] as const).forEach((side) => {
    const labels = projectedLabels
      .filter((label) => label.side === side)
      .sort((first, second) => first.anchorY - second.anchorY || first.cameraDistance - second.cameraDistance);
    const sideLayouts = tryCameraLayoutSide(
      labels,
      side,
      viewportWidth,
      viewportHeight,
      moduleLabelDistance,
      metrics,
      obstacles,
    );
    if (!sideLayouts) sideLayoutFailed = true;
    else layouts.push(...sideLayouts);
  });

  if (!sideLayoutFailed && !hasAnyOverlap(layouts, obstacles)) return layouts;
  return resolveViewportFallback(
    projectedLabels,
    viewportWidth,
    viewportHeight,
    moduleLabelDistance,
    metrics,
    obstacles,
  );
}
