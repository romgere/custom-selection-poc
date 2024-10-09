import './style.css';
import Selectable, { type SelectionChangeEvent } from './selectable';


const main = document.getElementById('app') as HTMLDivElement;
const page = document.getElementById('report-page') as HTMLDivElement;
const selectables = [...page.querySelectorAll<HTMLDivElement>('[selectable]')];

const selectable = new Selectable({
  area: main,
  selectables
});


selectable.addEventListener("selectionstart", () => console.log('Select start ...'));

selectable.addEventListener("selectionchange", (e: SelectionChangeEvent<HTMLDivElement>) => {
  console.log('selectionchange', e.detail.selection.map(e => e.style.backgroundColor));
  selectables.filter(i => !e.detail.selection.includes(i)).forEach(i => i.classList.remove("selected"));
  e.detail.selection.forEach(i => i.classList.add("selected"));
});

selectable.addEventListener("selectionend", () => console.log('Select end !'));