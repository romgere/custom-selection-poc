import './style.css';
import Selectable, { type SelectionChangeEvent } from './selectable';
import Moveable, { type MoveEvent, MoveEndEvent } from './moveable';

let zoom = 0.5;

const main = document.getElementById('app') as HTMLDivElement;
const page = document.getElementById('report-page') as HTMLDivElement;
const items = [...page.querySelectorAll<HTMLDivElement>('[selectable]')];

const selectable = new Selectable({
  area: main,
  selectionFeebackContainer: page,
  selectables: items,
  zoom
});
selectable.addEventListener("selectionchange", (e: SelectionChangeEvent<HTMLDivElement>) => {
  console.log('selectionchange', e.detail.selection.map(e => e.style.backgroundColor));
  items.filter(i => !e.detail.selection.includes(i)).forEach(i => i.classList.remove("selected"));
  e.detail.selection.forEach(i => i.classList.add("selected"));
});


const moveable = new Moveable({
  area: main,
  moveables: items,
  zoom
});
moveable.addEventListener("movestart", () => selectable.stopSelection());
moveable.addEventListener("moveend", (e: MoveEndEvent<HTMLDivElement>) => {
  e.detail.item.style.left = `${pxToMm(e.detail.newPosition.x)}mm`;
  e.detail.item.style.top = `${pxToMm(e.detail.newPosition.y)}mm`;
});
moveable.addEventListener("move", (e: MoveEvent<HTMLDivElement>) => {
  e.detail.item.style.left = `${e.detail.newPosition.x}px`;
  e.detail.item.style.top = `${e.detail.newPosition.y}px`;
});



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
  console.log(`scale(${zoom});`);
  document.querySelector<HTMLDivElement>(
    '#report-page'
  )!.style.zoom = `${zoom}`;

  selectable.updateOption({ zoom })
  moveable.updateOption({ zoom })
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