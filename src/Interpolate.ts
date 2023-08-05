
export type Point = [number, number];

export function interpolate(points: Point[], t: number): Point {
  if (points.length < 2)
    throw Error("Need at least two points for interpolation");

  if (t <= 0) return points[0];
  if (t >= 1) return points[points.length - 1];

  let segmentLength = 1 / (points.length - 1);
  let index = Math.floor(t / segmentLength);

  if (index == points.length - 1) index--;

  let relT = (t - segmentLength * index) / segmentLength;
  let point1 = points[index];
  let point2 = points[index + 1];

  let tangent1, tangent2;
  if (index == 0) {
    tangent1 = [0, 0];
  } else {
    let point0 = points[index - 1];
    tangent1 = [(point2[0] - point0[0]) / 2, (point2[1] - point0[1]) / 2];
  }

  if (index == points.length - 2) {
    tangent2 = [0, 0];
  } else {
    let point3 = points[index + 2];
    tangent2 = [(point3[0] - point1[0]) / 2, (point3[1] - point1[1]) / 2];
  }

  let t2 = relT * relT;
  let t3 = t2 * relT;

  let h00 = 2 * t3 - 3 * t2 + 1;
  let h10 = t3 - 2 * t2 + relT;
  let h01 = -2 * t3 + 3 * t2;
  let h11 = t3 - t2;

  let rx = h00 * point1[0] + h10 * tangent1[0] + h01 * point2[0] + h11 * tangent2[0];
  let ry = h00 * point1[1] + h10 * tangent1[1] + h01 * point2[1] + h11 * tangent2[1];

  return [rx, ry];
}

export function dist(a: Point, b: Point): number {
  let dx = b[0] - a[0];
  let dy = b[1] - a[1];
  return Math.sqrt(dx * dx + dy * dy);
}

export function rotate(vec: Point, angle: number): Point {
  let sin = Math.sin(angle);
  let cos = Math.cos(angle);
  return [vec[0] * cos - vec[1] * sin, vec[0] * sin + vec[1] * cos];
}
