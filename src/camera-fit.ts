export type CameraFitVector = [number, number, number];

export interface ModuleFocusFrame {
  center: CameraFitVector;
  size: CameraFitVector;
  moduleWidth: number;
}

const DEGREES_TO_RADIANS = Math.PI / 180;

function normalize([x, y, z]: CameraFitVector): CameraFitVector {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function cross(
  [firstX, firstY, firstZ]: CameraFitVector,
  [secondX, secondY, secondZ]: CameraFitVector,
): CameraFitVector {
  return [
    firstY * secondZ - firstZ * secondY,
    firstZ * secondX - firstX * secondZ,
    firstX * secondY - firstY * secondX,
  ];
}

function projectedHalfExtent(axis: CameraFitVector, halfSize: CameraFitVector) {
  return Math.abs(axis[0]) * halfSize[0]
    + Math.abs(axis[1]) * halfSize[1]
    + Math.abs(axis[2]) * halfSize[2];
}

export function moduleFocusFrame(functionCount: number): ModuleFocusFrame {
  const moduleWidth = Math.min(9.2, Math.max(6.4, functionCount * 1.3));
  return {
    center: [0, 0, 1.05],
    size: [moduleWidth + 1, 3.2, 2.8],
    moduleWidth,
  };
}

export function journeyFocusFrame(stepCount: number): ModuleFocusFrame {
  const moduleWidth = Math.min(18.2, Math.max(11.8, stepCount * 1.12));
  return {
    center: [0, 0, 1.45],
    size: [moduleWidth + 1.4, 7.3, 4.2],
    moduleWidth,
  };
}

export function distanceToFitPerspectiveBox(
  boxSize: CameraFitVector,
  cameraDirection: CameraFitVector,
  verticalFovDegrees: number,
  viewportAspect: number,
  padding = 1.06,
) {
  const backward = normalize(cameraDirection);
  const worldUp: CameraFitVector = Math.abs(backward[1]) > 0.995 ? [0, 0, 1] : [0, 1, 0];
  const right = normalize(cross(worldUp, backward));
  const up = normalize(cross(backward, right));
  const halfSize: CameraFitVector = [boxSize[0] / 2, boxSize[1] / 2, boxSize[2] / 2];
  const verticalFov = Math.max(1, verticalFovDegrees) * DEGREES_TO_RADIANS;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(0.1, viewportAspect));
  const heightDistance = projectedHalfExtent(up, halfSize) / Math.tan(verticalFov / 2);
  const widthDistance = projectedHalfExtent(right, halfSize) / Math.tan(horizontalFov / 2);
  const depthExtent = projectedHalfExtent(backward, halfSize);
  return (Math.max(heightDistance, widthDistance) + depthExtent) * Math.max(1, padding);
}
