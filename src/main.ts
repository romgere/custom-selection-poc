import './style.css';
/*
import './wc.ts';

import { Draggable } from '@neodrag/vanilla';
import Selectable from 'selectable.js';

const svg = `
<svg id="report-page" viewBox="0 0 210mm 297mm" xmlns="http://www.w3.org/2000/svg">
  <style>
    div {
      height: 100%;
      overflow: auto;
    }
  </style>

  <defs>
    <!-- A marker to be used as an arrowhead -->
    <marker
      id="arrow"
      viewBox="0 0 10 10"
      refX="5"
      refY="5"
      markerWidth="6"
      markerHeight="6"
      orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" />
    </marker>
  </defs>


  <g id="text-rect">
  <rect x="5mm" y="5mm" width="200mm" height="25mm" stroke="black" fill="transparent" stroke-width="5" class="ui-selectable" />

  <!-- Rich text -->
  <foreignObject x="10mm" y="10mm" width="190mm" height="15mm">
    <div class="text ui-selectable">
      Lorem <b>ipsum dolor sit amet</b>, consectetur adipiscing elit. <u>Sed mollis mollis</u>
      mi ut ultricies. Nullam magna ipsum, porta vel dui convallis, rutrum
      imperdiet eros. <b>Aliquam <s>erat</s> volutpat</b>.
    </div>
  </foreignObject>
  </g>

  <rect draggable class="ui-selectable" x="30mm" y="40mm" width="25mm" height="25mm" stroke="black"  fill="red" stroke-width="5"/>
  <rect draggable class="ui-selectable" x="40mm" y="50mm" width="25mm" height="25mm" stroke="black"  fill="blue" stroke-width="5"/>
  <rect class="ui-selectable" x="50mm" y="60mm" width="25mm" height="25mm" stroke="black"  fill="green" stroke-width="5"/>


  <g id="rect-group">
    <rect class="ui-selectable" x="130mm" y="50mm" width="15mm" height="15mm" stroke="black"  fill="orange" stroke-width="5"/>
    <rect class="ui-selectable" x="160mm" y="50mm" width="15mm" height="15mm" stroke="black"  fill="orange" stroke-width="5"/>
    <rect class="ui-selectable" x="145mm" y="80mm" width="15mm" height="15mm" stroke="black"  fill="orange" stroke-width="5"/>
    <text class="ui-selectable" x="130mm" y="75mm">can we use SVG group ?</text>
  </g>

  <!-- Custom element -->
  <foreignObject x="10mm" y="100mm" width="90mm" height="100mm" id="wc-rect">
  <div class="ui-selectable">
    <my-custom-element foo="bar" bar="foo"></my-custom-element>
    </div>
  </foreignObject>
  <foreignObject x="110mm" y="100mm" width="90mm" height="100mm">
    <my-custom-element foo="bar" bar="foo"></my-custom-element>   
  </foreignObject>

  <image href="https://placehold.co/600x400" x="25mm" y="150mm" height="400px" width="600px" id="img-drag" class="ui-selectable"/>


  <!-- A line with a marker (this will probably need dedicated move/resize logic) -->
  <line
    class="ui-selectable"
    id="line-drag"
    x1="150mm"
    y1="287mm"
    x2="105mm"
    y2="260mm"
    stroke="black"
    stroke-width="5"
    marker-end="url(#arrow)" />
</svg>
`;

document.querySelector<HTMLDivElement>('#app')!.innerHTML = svg;

const pxPermm = 3.779527537027993;

// Selectable
const selectable = new Selectable();

let initialPos1 = { x: 0, y: 0 };
const dragInstance = new Draggable(document.querySelector('[draggable]')!, {
  transform: () => '',
  onDragStart: ({ currentNode, offsetX, offsetY }) => {
    selectable.disable();
    const { x, y } = currentNode.getBBox();
    initialPos1.x = initialPos1.x === 0 ? x : initialPos1.x;
    initialPos1.y = initialPos1.y === 0 ? y : initialPos1.y;
  },
  onDrag: ({ offsetX, offsetY, currentNode }) => {
    currentNode.setAttribute('x', initialPos1.x + offsetX);
    currentNode.setAttribute('y', initialPos1.y + offsetY);
  },
  onDragEnd: ({ currentNode, rootNode, offsetX, offsetY }) => {
    selectable.enable();
    const { x, y } = currentNode.getBBox();
    currentNode.setAttribute('x', `${x / pxPermm}mm`);
    currentNode.setAttribute('y', `${y / pxPermm}mm`);
  },
});

const dragInstanceGroup = new Draggable(
  document.querySelector('#rect-group')!,
  {
    onDragStart: () => {
      selectable.disable();
    },
    onDragEnd: () => {
      selectable.enable();
    },
  }
);
const dragInstanceWC = new Draggable(document.querySelector('#wc-rect')!, {
  handle: document.querySelector('my-custom-element')!,
  onDragStart: () => {
    selectable.disable();
  },
  onDragEnd: () => {
    selectable.enable();
  },
});

const dragInstanceLineDrag = new Draggable(
  document.querySelector('#line-drag')!,
  {
    onDragStart: () => {
      selectable.disable();
    },
    onDragEnd: () => {
      selectable.enable();
    },
  }
);
const dragInstanceImgDrag = new Draggable(
  document.querySelector('#img-drag')!,
  {
    onDragStart: () => {
      selectable.disable();
    },
    onDragEnd: () => {
      selectable.enable();
    },
  }
);
const dragInstanceTextRect = new Draggable(
  document.querySelector('#text-rect')!,
  {
    onDragStart: () => {
      selectable.disable();
    },
    onDragEnd: () => {
      selectable.enable();
    },
  }
);

// Test zoom
let zoom = 1;
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
  )!.style.transform = `scale(${zoom})`;
}

let newRectIdx = 0;
document.querySelector('#add-btn')?.addEventListener('click', function () {
  const newRect = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'rect'
  );
  newRect.setAttribute('x', `${50 + ++newRectIdx * 10}mm`);
  newRect.setAttribute('y', `${60 + newRectIdx * 10}mm`);
  newRect.setAttribute('height', '25mm');
  newRect.setAttribute('width', '25mm');
  newRect.setAttribute('stroke', 'black');
  newRect.setAttribute(
    'fill',
    '#' + Math.round(0xffffff * Math.random()).toString(16)
  );
  newRect.setAttribute('stroke-width', '5');
  newRect.setAttribute('draggable', '');

  let initialPos = { x: 0, y: 0 };
  new Draggable(newRect, {
    transform: () => '',
    onDragStart: ({ currentNode, offsetX, offsetY }) => {
      selectable.disable();
      const { x, y } = currentNode.getBBox();
      console.log(x, y);
      initialPos.x = initialPos.x === 0 ? x : initialPos.x;
      initialPos.y = initialPos.y === 0 ? y : initialPos.y;
    },
    onDrag: ({ offsetX, offsetY, currentNode }) => {
      currentNode.setAttribute('x', initialPos.x + offsetX);
      currentNode.setAttribute('y', initialPos.y + offsetY);
    },
    onDragEnd: ({ currentNode, rootNode, offsetX, offsetY }) => {
      selectable.enable();
      const { x, y } = currentNode.getBBox();
      currentNode.setAttribute('x', `${x / pxPermm}mm`);
      currentNode.setAttribute('y', `${y / pxPermm}mm`);
    },
  });

  const svgEl = document.querySelector<SVGElement>('#app > svg') as SVGElement;
  svgEl.appendChild(newRect);
  selectable.add(newRect);
});
*/
