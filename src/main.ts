import './style.css';

// https://github.com/daybrush/overlap-area ????

type Coord = { x: number, y :number };
type Rect = Coord & { width: number, height :number };
// Rectangle "Polygone" is array of vertices. ! WARNING ! "point in poly" method need vertice to be in a sequential order (clockwise or anti-clockwise) otherwise it won't work.
type Polygone = [Coord, Coord, Coord, Coord];

// Make this generic/dynamic
type SelectableType = HTMLDivElement;

const pos0 = { x: 0, y: 0};
const rect0 = {...pos0, width: 0, height: 0 };
const main = document.getElementById('app') as HTMLDivElement;
const page = document.getElementById('report-page') as HTMLDivElement;

let isSelecting = false;
let selectionFeedback: HTMLDivElement = document.createElement('div');
selectionFeedback.classList.add('selection-rect')

let selectionStart: Coord = pos0;
let selectionRect: Rect = rect0;

const selectableItems = page.querySelectorAll<SelectableType>('[selectable]');
type ItemPolygone = { item: SelectableType, polygone: Polygone}
let selectableItemsPolygones: ItemPolygone[] = [];

// Start selection mode, add selectionFeedback to DOM & compute selectable rect
main.addEventListener('mousedown', function(e) {
  selectionStart = { x: e.clientX, y: e.clientY };
  selectionRect = {...selectionStart, width: 0, height: 0 };

  // Compute selectable element Polygones once for all at start (they are not supposed to move during the selection)
  computeSelectablePolygones();
  
  updateSelectionFeedback();

  main.append(selectionFeedback);

  isSelecting = true;
});

// Update selection area & compute Selection
main.addEventListener('mousemove', function(e) {
  if (isSelecting) {
    const x1 = Math.min(selectionStart.x, e.clientX);
    const y1 = Math.min(selectionStart.y, e.clientY);
    const x2 = Math.max(selectionStart.x, e.clientX);
    const y2 = Math.max(selectionStart.y, e.clientY);

    selectionRect = {x: x1, y: y1, width: x2 - x1, height: y2 - y1};

    // Update Selection Rect DOM position & size
    updateSelectionFeedback();

    // Check what's inside selection
    computeSelection();
  }
});

// Stop Selection & get rid of selectionFeedback
main.addEventListener('mouseup', function() {
  if (isSelecting) {
    selectionFeedback.remove()
    selectionStart = pos0;
    selectionRect = rect0;
    isSelecting = false;
  }
});


// This update the selection rect according to (new) selection start/end position
function updateSelectionFeedback() {
  selectionFeedback.style.left = `${selectionRect.x}px`;
  selectionFeedback.style.top = `${selectionRect.y}px`;
  selectionFeedback.style.width = `${selectionRect.width}px`;
  selectionFeedback.style.height = `${selectionRect.height}px`;
}

// This compute polygones for all selectable elements
function computeSelectablePolygones() {

  selectableItemsPolygones = [...selectableItems].map<ItemPolygone>((i) => {

    // Extract rotation value from css (todo: refactor this)
    const angle = i.style.transform.includes('rotate') ? parseInt(i.style.transform.replace('rotate(', '').replace('deg)', '')) : 0;

    const rect = i.getBoundingClientRect();

    if (!rotate) {
      return {
        item:i ,
        polygone: [
          { x: rect.left, y: rect.top }, // tl
          { x: rect.right, y: rect.top }, // tr
          { x: rect.right, y: rect.bottom }, // br
          { x: rect.left, y: rect.bottom }, // bl
        ]
      }
    }


    const pageRect = page.getBoundingClientRect();

    const center: Coord = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };

    // Get unrotated rectangle Bounds
    const x1 = mmToPx(parseInt(i.style.left)) + pageRect.left;
    const y1 = mmToPx(parseInt(i.style.top)) + pageRect.top;

    const width = mmToPx(parseInt(i.style.width));
    const height = mmToPx(parseInt(i.style.height));

    const x2 = x1 + width;
    const y2 = y1 + height;

    // Compute rotated vertice
    const rectBounds: Polygone = [
      rotate({x: x1, y: y1}, center, -angle), // tl
      rotate({x: x2, y: y1}, center, -angle), // tr
      rotate({x: x2, y: y2}, center, -angle), // br
      rotate({x: x1, y: y2}, center, -angle), // bl
    ];


    return {
      item: i,
      polygone: rectBounds
    };
  });

  // for debug, add small "pixel" at computed vertices position
  // for (const p of selectableItemsPolygones ) {    
  //   for (const k in p.polygone ) {
  //     const d = document.createElement('div')
  //     d.classList.add('debug');
  //     d.style.left = `${p.polygone[k].x}px`;
  //     d.style.top = `${p.polygone[k].y}px`;      
  //     main.append(d);
  //   }
  // }
}

function computeSelection() {
  const selectionPoly: Polygone = [
    { x: selectionRect.x, y: selectionRect.y }, // tl
    { x: selectionRect.x + selectionRect.width, y: selectionRect.y }, // tr
    { x: selectionRect.x + selectionRect.width, y: selectionRect.y+ selectionRect.height }, // br
    { x: selectionRect.x, y: selectionRect.y + selectionRect.height }, // bl
  ];

  const selectionInfo = selectableItemsPolygones.reduce<{selected: SelectableType[], unselected: SelectableType[]}>((acc, i) => {
    
    if (testCollision(selectionPoly, i.polygone)) {
      acc.selected.push(i.item);
    } else {
      acc.unselected.push(i.item);
    }

    return acc;
  }, { selected: [], unselected: [] });
  
  


  console.log('selection', selectionInfo.selected?.map((e) => e.style.backgroundColor));

  for (let e of selectionInfo.selected) {
    e.classList.add('selected')
  }
  for (let e of selectionInfo.unselected) {
    e.classList.remove('selected')
  }
}

function testCollision(rect1: Polygone, rect2: Polygone) {
  
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
function pointInPoly(point: Coord, poly: Polygone) {
  
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




/////////////////////////////////////////
// From report engine
function rotate(point: Coord, center: Coord, angle: number): Coord {
  const { x: px, y: py } = point;
  const { x: cx, y: cy } = center;

  let radians = (Math.PI / 180) * angle;
  let cos = Math.cos(radians);
  let sin = Math.sin(radians);
  let x = cos * (px - cx) + sin * (py - cy) + cx;
  let y = cos * (py - cy) - sin * (px - cx) + cy;
  return { x, y };
}

// https://github.com/daybrush/ruler?tab=readme-ov-file#ruler-units
const pxPerMm = 3.77952; // Is this always true ?

function mmToPx(mm: number) {
  return mm * pxPerMm;
}
// From report engine
/////////////////////////////////////////