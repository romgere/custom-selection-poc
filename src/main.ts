import './style.css';
import './reshapable.css';
import Selectable from './selectable';
import Moveable, { type MoveEvent, type MoveEndEvent } from './moveable';
import Reshapable, { type ReshapeEndEvent } from './reshapable';

let zoom = 1;

const main = document.getElementById('app') as HTMLDivElement;
const page = document.getElementById('report-page') as HTMLDivElement;
const items = [...page.querySelectorAll<HTMLDivElement>('[selectable]')];

const selectable = new Selectable({
  area: main,
  selectionFeebackContainer: page,
  selectables: items,
  zoom
});
const moveable = new Moveable({
  area: main,
  moveables: items,
  zoom,
  selectable
});
const reshapable = new Reshapable({
  selectable,
  zoom
})
moveable.addEventListener("moveend", (e: MoveEndEvent<HTMLDivElement>) => {
  for (const move of e.detail) {
    move.item.style.left = `${pxToMm(move.newPosition.x)}mm`;
    move.item.style.top = `${pxToMm(move.newPosition.y)}mm`;
  }
});
moveable.addEventListener("move", (e: MoveEvent<HTMLDivElement>) => {
  for (const move of e.detail) {
    move.item.style.left = `${move.newPosition.x}px`;
    move.item.style.top = `${move.newPosition.y}px`;
  }
});
reshapable.addEventListener("reshapeend", (e: ReshapeEndEvent<HTMLDivElement>) => {
  const { item } = e.detail
  if (e.detail.type === 'resize') {
    item.style.left = `${pxToMm(e.detail.parentRelative.x)}mm`;
    item.style.top = `${pxToMm(e.detail.parentRelative.y)}mm`;
    item.style.width = `${pxToMm(e.detail.parentRelative.width)}mm`;
    item.style.height = `${pxToMm(e.detail.parentRelative.height)}mm`;

  } else if (e.detail.type === 'rotate') {
    item.style.transform = `rotate(${e.detail.angle}deg)`;
  } 
})


/////////////////////
// Test zoom
updateZoom();

document.querySelector('#zoom-plus')?.addEventListener('click', function () {
  zoom += 0.1;
  updateZoom();
});
document.querySelector('#zoom-minus')?.addEventListener('click', function () {
  zoom -= 0.1;
  updateZoom();
});
document.querySelector('#zoom-reset')?.addEventListener('click', function () {
  zoom = 1;
  updateZoom();
});

function updateZoom() {
  document.querySelector<HTMLDivElement>(
    '#report-page'
  )!.style.zoom = `${zoom}`;

  selectable.updateOption({ zoom })
  moveable.updateOption({ zoom })
  reshapable.updateOption({ zoom })
}
// Test zoom
/////////////////////


////////////////////////////////////////
// FROM report engine

const pxPerMm = 3.77952; // Is this always true ?

export function pxToMm(px: number) {
  // JS hack to get a real 2 digit number (instead of weird 43.2000000001 default behaviour)
  return Math.round((px / pxPerMm) * 100) / 100;
}

// FROM report engine
////////////////////////////////////////