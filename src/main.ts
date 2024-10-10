import './style.css';
import Selectable, { type SelectionChangeEvent } from './selectable';


let zoom = 1;

const main = document.getElementById('app') as HTMLDivElement;
const page = document.getElementById('report-page') as HTMLDivElement;
const selectables = [...page.querySelectorAll<HTMLDivElement>('[selectable]')];

const selectable = new Selectable({
  area: main,
  selectionFeebackContainer: page,
  selectables,
  zoom
});


selectable.addEventListener("selectionstart", () => console.log('Select start ...'));

selectable.addEventListener("selectionchange", (e: SelectionChangeEvent<HTMLDivElement>) => {
  console.log('selectionchange', e.detail.selection.map(e => e.style.backgroundColor));
  selectables.filter(i => !e.detail.selection.includes(i)).forEach(i => i.classList.remove("selected"));
  e.detail.selection.forEach(i => i.classList.add("selected"));
});

selectable.addEventListener("selectionend", () => console.log('Select end !'));

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
}
// Test zoom
/////////////////////