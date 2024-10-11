export type Coord = { x: number, y :number };
export type Size = { width: number, height :number }
export type Rect = Coord & Size;
export type Polygone = Coord[];

export function size0() { return { width: 0, height: 0 } };
export function pos0() { return { x: 0, y: 0 } };
export function rect0() { return {...pos0(), width: 0, height: 0 } };

// Extract rotation value from a css transform 
export function getAngleFromTransform(transform: string) {
  const match = transform.trim().match(/rotate\((.*?)deg\)/)
  return match && match.length ? parseInt(match[1]) : 0;
}

////////////////////////////////////
// Move to math-utils.ts
export function testSimpleRectCollision(rect1: Polygone, rect2: Polygone) {

    for (const vertice of rect1) {
      if (pointInRect(vertice, rect2)) {
        return true;
      }
    }
  
    for (const vertice of rect2) {
      if (pointInRect(vertice, rect1)) {
        return true;
      }
    }
  
    return false;
  }
  
  
  export function pointInRect(point: Coord, poly: Polygone) {
    return point.x >= poly[0].x && point.x <= poly[1].x
      && point.y >= poly[0].y && point.y <= poly[2].y;
  }
  
  
  export function testPolygoneCollision(rect1: Polygone, rect2: Polygone) {
    // Considering 2 rects collisionning when for both rects, one of the vertice is contains in the other one.
  
    for (const vertice of rect1) {
      if (pointInPoly(vertice, rect2)) {
        return true;
      }
    }
  
    for (const vertice of rect2) {
      if (pointInPoly(vertice, rect1)) {
        return true;
      }
    }
  
    return false;
  }
  
  
  
  // ray-casting algorithm based on
  // https://wrf.ecse.rpi.edu/Research/Short_Notes/pnpoly.html
  // Polygone vertices need to be in a sequential order (clockwise or anti-clockwise) otherwise it won't work.
  export function pointInPoly(point: Coord, poly: Polygone) {
    
    const { x, y } = point;
    
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        var xi = poly[i].x, yi = poly[i].y;
        var xj = poly[j].x, yj = poly[j].y;
        
        var intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    
    return inside;
  };
  // Move to math-utils.ts
  ////////////////////////////////////


/////////////////////////////////////////
// From report engine
export function rotate(point: Coord, center: Coord, angle: number): Coord {
  const { x: px, y: py } = point;
  const { x: cx, y: cy } = center;

  let radians = (Math.PI / 180) * angle;
  let cos = Math.cos(radians);
  let sin = Math.sin(radians);
  let x = cos * (px - cx) + sin * (py - cy) + cx;
  let y = cos * (py - cy) - sin * (px - cx) + cy;
  return { x, y };
}  

export function step(value: number, step: number) {
  return value && step > 1 ? Math.floor(value / step) * step : value;
}

/**
 * Find intersection point between 2 lines (projected)
 * https://jsfiddle.net/justin_c_rounds/Gd2S2/light/
 */
export function intersect(
  line1: [Coord, Coord],
  line2: [Coord, Coord],
): Coord | undefined {
  const [{ x: line1StartX, y: line1StartY }, { x: line1EndX, y: line1EndY }] =
    line1;

  const [{ x: line2StartX, y: line2StartY }, { x: line2EndX, y: line2EndY }] =
    line2;

  let denominator =
    (line2EndY - line2StartY) * (line1EndX - line1StartX) -
    (line2EndX - line2StartX) * (line1EndY - line1StartY);

  if (denominator == 0) {
    return undefined;
  }

  let a = line1StartY - line2StartY;
  let b = line1StartX - line2StartX;

  let numerator1 =
    (line2EndX - line2StartX) * a - (line2EndY - line2StartY) * b;

  return {
    x: line1StartX + (numerator1 / denominator) * (line1EndX - line1StartX),
    y: line1StartY + (numerator1 / denominator) * (line1EndY - line1StartY),
  };
}

// From report engine
/////////////////////////////////////////