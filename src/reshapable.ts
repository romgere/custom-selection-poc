import Selectable from './selectable';
import {
  rotate,
  pos0,
  rect0,
  size0,
  step,
  getAngleFromTransform,
  intersect
} from './utils'

import type {
  Coord,
  Size,
  Rect
} from './utils'

type ReshapeData<T> = {
  item: T;
  type: 'rotate' | 'resize',
}

type ResizeData = {
  type: 'resize',
  viewPortRelative: Rect,
  parentRelative: Rect,
}

type RotateData =  {
  type: 'rotate',
  angle: number,
  transform: string;
}

type Reshape<T extends HTMLElement> = ReshapeData<T> & (ResizeData | RotateData)

type ResizeHandleName = "tl" | "tc" | "tr" | "bl" | "bc" | "br";
const handleNames: ResizeHandleName[] = ["tl", "tc", "tr", "bl", "bc", "br"];
const handleClasses: Record<ResizeHandleName, string[]> = {
  tl: ["top", "left"],
  tc: ["top", "center"],
  tr: ["top", "right"],
  bl: ["bottom", "left"],
  bc: ["bottom", "center"],
  br: ["bottom", "right"]
}

export interface ReshapeStartEvent<T extends HTMLElement> extends Event {
  readonly type: "reshapestart";
  detail: ReshapeData<T>;
}

export interface ReshapeEvent<T extends HTMLElement> extends Event {
  readonly type: "reshape";
  detail: Reshape<T>;
}

export interface ReshapeEndEvent<T extends HTMLElement> extends Event {
  readonly type: "reshapeend";
  detail: Reshape<T>;
}

type ReshapableOption<T extends HTMLElement> = ReshapableMutableOption & {
  reshapables?: T[];
  selectable?: Selectable<T>;
};

type ReshapableMutableOption = {
  zoom?: number;
  rotationStep?: number,
  observedAttributes?: string[];
};

const defaultOptions: Required<ReshapableMutableOption> = {
  zoom: 1,
  rotationStep: 15,
  observedAttributes: ['style', 'width', 'height']
};

// This allow to keep track of item we resize/rotate
type ReshapableItemRef<T extends HTMLElement> ={
  observer: MutationObserver,
  item: T;
  resizeUIContainer: HTMLDivElement;
}


/**
 * Disclamer: here we're dealing only with "viewport relative" coordinates. There's 2 places where we get/need "parent relative" positions : 
 * - when trigerring "reshapable" & "reshapableend" event to send "parent relative" coordinates (for dev convenience)
 * - when computing initial item position. We're not using getBoundingRect because we want the "real" size of item (the one before rotation). This is immediatly convert to "viewport relative".
 */
export default class Reshapable<ReshapableType extends HTMLElement> extends EventTarget {
  private _options: Required<ReshapableMutableOption> = defaultOptions;

  // Support for Selectable, 
  private _selectable?: Selectable<ReshapableType>;  

  // Keep track of existing Resizable Item, UI elements & observer
  private _resizeUIItems: ReshapableItemRef<ReshapableType>[] = [];
  
  // Values that are computed when rotate/resize is starting
  private _initialHandlePosition: Record<ResizeHandleName, Coord> = {
    tl: pos0(),
    tc: pos0(),
    tr: pos0(),
    bl: pos0(),
    bc: pos0(),
    br: pos0(),
  };
  private _initialSize: Size = size0();
  private _initialCenter: Coord = pos0();  
  private _initialPosition: Coord = pos0();  
  private _initialAngle = 0;
  private _parentCoords: Coord = pos0();
  private _pendingResize: Rect = rect0();    
  private _pendingRotation = 0;

  // Name of the handle used for resize
  private _resizeHandleName: ResizeHandleName | undefined;

  // Item being resized/rotated
  private _currentItem: ReshapableType | undefined;

  // What action is being performed
  private _isResizing = false;
  private _isRotating = false;

  constructor(options: ReshapableOption<ReshapableType>) {
    super();

    this._selectable = options.selectable;
        
    this.updateOption(options);

    // When used with seletable, automatically update reshapable list when selection change
    if (this._selectable) {
      this._selectable.addEventListener("selectionchange", this._onSelectionChange.bind(this));
    }
    
    document.addEventListener("mousemove", this._onMouseMove.bind(this));
    document.addEventListener("mouseup", this._onMouseUp.bind(this));
  }

  updateOption(options: ReshapableMutableOption) {
    this._options = {
      ...this._options,
      ...options
    };
  }

  setReshapableItems(items: ReshapableType[]) {
    const existingItems = this._resizeUIItems.map(({item}) => item)
    const newItems = items.filter((i) => !existingItems.includes(i));
    const deletedItems = existingItems.filter((i) => !items.includes(i));

    // Remove old UI
    for (const i of deletedItems) {
      this._removeUi(i)
    }

    // Draw new UI
    for(const i of newItems) {
      this._drawUi(i)
    }
  }

  clearReshapableItems() {
    this.setReshapableItems([])
  }

  private _onSelectionChange() {
    this.setReshapableItems(this._selectable?.getSelection() ?? []);
  }

  private _drawUi(item: ReshapableType) {
    const container = document.createElement('div');
    container.classList.add('reshapable-container');

    const selectionRect = document.createElement('div');
    selectionRect.classList.add('selection-border');

    const rotateBar = document.createElement('div');
    rotateBar.classList.add('rotate-bar');

    const rotateHandle = document.createElement('div');
    rotateHandle.classList.add('rotate-handle');
    rotateHandle.setAttribute('handle-name', 'rotate');
    rotateHandle.addEventListener('mousedown', this._startRotate(item));

    container.append(selectionRect);
    container.append(rotateBar);
    container.append(rotateHandle);

    for (const handleName of handleNames) {
      const resizeHandle = document.createElement('div');
      resizeHandle.setAttribute('handle-name', handleName);
      resizeHandle.classList.add('resize-handle');
      resizeHandle.classList.add(...handleClasses[handleName]);
      resizeHandle.addEventListener('mousedown', this._startResize(handleName, item));
      container.append(resizeHandle);
    }

    this._updateUIStyle(container, item);

    // Observe style changes to update UI when needed
    const observer = new MutationObserver(this._onReshapableItemMutation(item, container));
    observer.observe(item, { attributes: true });

    this._resizeUIItems.push({
      item,
      resizeUIContainer: container,
      observer
    });

    item.after(container);
  }

  private _onReshapableItemMutation(item: ReshapableType, resizeUIContainer: HTMLDivElement) {
    let animationReq: number | undefined;
    // Keep a single ref to update metho for that item, so that we can improve update by using cancelAnimationFrame/requestAnimationFrame
    const performUpdate = () => {
      this._updateUIStyle(resizeUIContainer, item);
    };

    return (mutationList: MutationRecord []) => {
      for (const mutation of mutationList) {
        if (mutation.type === 'attributes' && mutation.attributeName && this._options.observedAttributes.includes(mutation.attributeName)) {
          animationReq && cancelAnimationFrame(animationReq);
          animationReq = requestAnimationFrame(performUpdate)          
        }
      }
    }
  }

  // Move/resize/rotate UI according to its item
  private _updateUIStyle(container: HTMLDivElement, item: ReshapableType) {
    const angle = getAngleFromTransform(item.style.transform);
    const itemRect = rect0();
   
    // const itemStyle = getComputedStyle(item);
    // itemRect.x = parseFloat(itemStyle.left);
    // itemRect.y = parseFloat(itemStyle.top);
    // itemRect.width = parseFloat(itemStyle.width);
    // itemRect.height = parseFloat(itemStyle.height);
    itemRect.x = item.offsetLeft;
    itemRect.y = item.offsetTop;
    itemRect.width = item.offsetWidth;
    itemRect.height = item.offsetHeight;

    container.style.width = `${itemRect.width}px`;
    container.style.height = `${itemRect.height}px`;
    container.style.left = `${itemRect.x}px`;
    container.style.top = `${itemRect.y}px`;
    
    container.style.transform = angle ? `rotate(${angle}deg)` : '';    
  }

  private _getItemUi(item: ReshapableType, remove = false): ReshapableItemRef<ReshapableType> | undefined {
    const idx = this._resizeUIItems.findIndex((e) => e.item === item)
    if (idx < 0) {
      return;
    }

    return remove ? this._resizeUIItems.splice(idx, 1)[0] : this._resizeUIItems[idx]
  }

  private _removeUi(item: ReshapableType) {
    const ui = this._getItemUi(item, true);
    if (ui) {
      ui.observer.disconnect();
      ui.resizeUIContainer.remove()
    }
  }

  private _startResize(handleName: ResizeHandleName, item: ReshapableType) {
    return (e: MouseEvent) => {
      e.stopPropagation();
      this._computedInitialValues(item);
      this._resizeHandleName = handleName;
      this._isResizing = true;
      this._currentItem = item;

      this.dispatchEvent(new CustomEvent("reshapestart", {
        detail: { item, type: 'resize' }
      }) as ReshapeStartEvent<ReshapableType>);
    };
  }

  private _startRotate(item: ReshapableType) {
    return (e: MouseEvent) => {
      e.stopPropagation();
      this._computedInitialValues(item);
      this._isRotating = true;
      this._currentItem = item;

      this.dispatchEvent(new CustomEvent("reshapestart", {
        detail: { item, type: 'rotate' }
      }) as ReshapeStartEvent<ReshapableType>);
    }
  }

  private _onMouseMove(e: MouseEvent) {

    if (!this._currentItem || (!this._isResizing && !this._isRotating)) {
      return;
    }
    
    // Detect scrolling during selection & take into account
    const { parentElement: parent } = this._currentItem;
    const parentRect = parent?.getBoundingClientRect();
    const newParentCoords = parentRect ? { x: parentRect.left , y: parentRect.top }: pos0();
    
    const scrollTranslate = {
      x: newParentCoords.x - this._parentCoords.x,
      y: newParentCoords.y - this._parentCoords.y
    };

    const mouse = {
      x: e.clientX - scrollTranslate.x,
      y: e.clientY - scrollTranslate.y
    };

    if (this._isRotating) {

      const ui = this._getItemUi(this._currentItem);
      if (!ui) return; // make TS happy

      let angle = Math.round(
        Math.atan2(
          mouse.x - this._initialCenter.x,
          -(mouse.y - this._initialCenter.y),
        ) *
          (180 / Math.PI),
      );

      angle = step(angle, this._options.rotationStep);

      if (angle === this._pendingRotation) {
        return;
      }

      this.dispatchEvent(
        new CustomEvent("reshape", {
          bubbles: true,
          composed: true,
          detail: {
            type: 'rotate',
            item: this._currentItem,
            angle: this._pendingRotation,
            transform: `rotate(${angle}deg)`,
          },
        }) as ReshapeEvent<ReshapableType>,
      );

      this._pendingRotation = angle;

      ui.resizeUIContainer.style.transform = `rotate(${angle}deg)`;
    }

    if (this._isResizing) {

      const ui = this._getItemUi(this._currentItem);
      if (!ui) return; // make TS happy

      let newX = 0;
      let newY = 0;
      let newWidth = this._initialSize.width;
      let newHeight = this._initialSize.height;

      const { _initialAngle: angle } = this;

      // https://shihn.ca/posts/2020/resizing-rotated-elements/ (rotate function provided is wrong, but explanations are great)
      if (this._resizeHandleName === "br") {
        /*
         * Moving BR corner :
         *  - TL corner is fix
         *  - <move-rotate> only need to grow/shrink (no translate)
         *  - resized item will move & grow/shrink
         */
        const { tl } = this._initialHandlePosition; // TL handle position (with rotation, without pending resize)
        const center = { x: (tl.x + mouse.x) / 2, y: (tl.y + mouse.y) / 2 }; // new item center (including pending resize)

        const unrotatedTL = rotate(tl, center, angle); // unrotated TL handle position (fix position)
        const newBR = rotate(mouse, center, angle); // new unrotated TL handle position

        newWidth = newBR.x - unrotatedTL.x;
        newHeight = newBR.y - unrotatedTL.y;
        newX = unrotatedTL.x;
        newY = unrotatedTL.y;
      } else if (this._resizeHandleName === "tl") {
        // Moving TL corner :  BR corner is fix
        const { br } = this._initialHandlePosition;
        const center = { x: (br.x + mouse.x) / 2, y: (br.y + mouse.y) / 2 };
        const unrotatedBR = rotate(br, center, angle);
        const newTL = rotate(mouse, center, angle);
        newWidth = unrotatedBR.x - newTL.x;
        newHeight = unrotatedBR.y - newTL.y;
        newX = newTL.x;
        newY = newTL.y;;
      } else if (this._resizeHandleName === "tr") {
        // Moving TR corner : BL corner is fix
        const { bl } = this._initialHandlePosition;
        const center = { x: (bl.x + mouse.x) / 2, y: (bl.y + mouse.y) / 2 };
        const unrotatedBL = rotate(bl, center, angle);
        const newTR = rotate(mouse, center, angle);
        newWidth = newTR.x - unrotatedBL.x;
        newHeight = unrotatedBL.y - newTR.y;
        newX = unrotatedBL.x;
        newY = newTR.y;
      } else if (this._resizeHandleName === "bl") {
        // Moving BL corner : TR corner is fix
        const { tr } = this._initialHandlePosition;
        const center = { x: (tr.x + mouse.x) / 2, y: (tr.y + mouse.y) / 2 };
        const unrotatedTR = rotate(tr, center, angle);
        const newBL = rotate(mouse, center, angle);
        newWidth = unrotatedTR.x - newBL.x;
        newHeight = newBL.y - unrotatedTR.y;
        newX = newBL.x;
        newY = unrotatedTR.y;
      } else if (this._resizeHandleName === "tc") {
        // Moving top center : BC is fix

        /*
         * for top/bottom center handle case, we need to compute TC position (according to mouse Y).
         * It's Intersection point between :
         *  - an horizontal line at cursor Y
         *  - TC/BC line.
         */

        let TC: Coord | undefined = undefined;

        // Special case when rotation is 0/180
        if ([0, 180].includes(Math.abs(this._initialAngle))) {
          TC = { x: this._initialHandlePosition.tc.x, y: mouse.y };
        }
        // Special case when rotation is 90/270
        else if ([90, 270].includes(Math.abs(this._initialAngle))) {
          TC = { x: mouse.x, y: this._initialHandlePosition.tc.y };
        } else {
          TC = intersect(
            [mouse, { x: mouse.x + 100, y: mouse.y }],
            [this._initialHandlePosition.bc, this._initialHandlePosition.tc],
          );
        }

        if (!TC) {
          return;
        }

        const { bc } = this._initialHandlePosition;
        const center = { x: (bc.x + TC.x) / 2, y: (bc.y + TC.y) / 2 };
        const unrotatedBC = rotate(bc, center, angle);
        const newTC = rotate(TC, center, angle);
        newHeight = unrotatedBC.y - newTC.y;
        newX = center.x - this._initialSize?.width / 2;
        newY = center.y - newHeight / 2;
      } else if (this._resizeHandleName === "bc") {
        // Moving top center : TC is fix
        let BC: Coord | undefined = undefined;

        // Special case when rotation is 0/180
        if ([0, 180].includes(Math.abs(this._initialAngle))) {
          BC = { x: this._initialHandlePosition.bc.x, y: mouse.y };
        }
        // Special case when rotation is 90/270
        else if ([90, 270].includes(Math.abs(this._initialAngle))) {
          BC = { x: mouse.x, y: this._initialHandlePosition.bc.y };
        } else {
          BC = intersect(
            [mouse, { x: mouse.x + 100, y: mouse.y }],
            [this._initialHandlePosition.bc, this._initialHandlePosition.tc],
          );
        }

        if (!BC) {
          return;
        }

        const { tc } = this._initialHandlePosition;
        const center = { x: (tc.x + BC.x) / 2, y: (tc.y + BC.y) / 2 };
        const unrotatedTC = rotate(tc, center, angle);

        const newBC = rotate(BC, center, angle);
        newHeight = newBC.y - unrotatedTC.y;

        newX = center.x - this._initialSize?.width / 2;
        newY = center.y - newHeight / 2;
      }
      
      const translateX = (newX - this._initialPosition.x) / this._options.zoom;
      const translateY = (newY - this._initialPosition.y) / this._options.zoom;

      // Handle zoom
      newWidth = newWidth / this._options.zoom;
      newHeight = newHeight / this._options.zoom;
      

      let transform = "";
      if (translateX || translateY) {
        transform += `translate(${translateX}px, ${translateY}px)`;
      }
      if (this._initialAngle) {
        transform += ` rotate(${this._initialAngle}deg)`;
      }
      
      ui.resizeUIContainer.style.transform = transform;
      ui.resizeUIContainer.style.height = `${newHeight}px`;
      ui.resizeUIContainer.style.width = `${newWidth}px`;

      // Store current resize values
      this._pendingResize = {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      };

      this.dispatchEvent(
        new CustomEvent("reshape", {
          bubbles: true,
          composed: true,
          detail: {
            type: "resize",
            item: this._currentItem,
            viewPortRelative: this._pendingResize,
            parentRelative: this._toParentRelative(this._pendingResize),
            transform,
          },
        }) as ReshapeEvent<ReshapableType>,
      );
    }
  }

  private _onMouseUp() {
    if (this._isRotating && this._currentItem) {

      const ui = this._getItemUi(this._currentItem);
      if (!ui) return; // make TS happy

      this._isRotating = false;

      if (this._pendingRotation !== this._initialAngle) {
        this.dispatchEvent(
          new CustomEvent("reshapeend", {
            bubbles: true,
            composed: true,
            detail: {
              type: 'rotate',
              item: this._currentItem,
              angle: this._pendingRotation,
              transform: ui.resizeUIContainer.style.transform,
            },
          }) as ReshapeEndEvent<ReshapableType>,
        );

        this._updateUIStyle(ui.resizeUIContainer, this._currentItem);
      }
    }

    if (this._isResizing && this._currentItem) {
      this._isResizing = false;

      const ui = this._getItemUi(this._currentItem);
      if (!ui) return; // make TS happy

      if (this._pendingResize) {
        this.dispatchEvent(
          new CustomEvent("reshapeend", {
            bubbles: true,
            composed: true,
            detail: {
              type: 'resize',
              item: this._currentItem,
              viewPortRelative: this._pendingResize,
              parentRelative: this._toParentRelative(this._pendingResize),
              transform: ui.resizeUIContainer.style.transform,
            },
          }) as ReshapeEndEvent<ReshapableType>,
        );

        this._updateUIStyle(ui.resizeUIContainer, this._currentItem);
      }
    }

    // Reset initial values
    this._initialCenter = pos0();
    this._initialSize = size0();
    this._initialAngle = 0;
    this._currentItem = undefined;

    for (const name of handleNames) {
      this._initialHandlePosition[name] = pos0();
    }
  }

  private _computedInitialValues(item: ReshapableType) {

    const ui = this._getItemUi(item);
    
    if (!ui) return; // make TS happy
    const { resizeUIContainer: container } = ui;

    // Get parent coord once for all (will be used to convert "parent relative pos" to/from "viewport relative pos")
    const { parentElement: parent } = item;
    const parentRect = parent?.getBoundingClientRect();
    this._parentCoords = parentRect ? { x: parentRect.left , y: parentRect.top }: pos0();

    // get item initial position (& "convert" to "viewport relative")
    this._initialPosition = {
      x: container.offsetLeft * this._options.zoom + this._parentCoords.x,
      y: container.offsetTop * this._options.zoom + this._parentCoords.y,
    };
    this._initialSize = {
      width: container.offsetWidth * this._options.zoom,
      height: container.offsetHeight * this._options.zoom,
    };

    this._initialCenter = {
      x: this._initialPosition.x + this._initialSize.width / 2 ,
      y: this._initialPosition.y + this._initialSize.height / 2 ,
    };

    this._initialAngle = getAngleFromTransform(container.style.transform);

    // Compute each handle initial position (top/bottom left/right handles are giving exact rect coord)
    for (const name of handleNames) {
      const handle = container.querySelector<HTMLDivElement>(`[handle-name=${name}]`)
      if (!handle) {
        break;
      }

      const r = handle.getBoundingClientRect();

      this._initialHandlePosition[name] = {
        x: r.left + r.width / 2 ,
        y: r.top + r.height / 2 ,
      };
    }
  }

  private _toParentRelative(rect: Rect) : Rect {
    return {
      x: (rect.x - (this._parentCoords?.x ?? 0)) / this._options.zoom,
      y: (rect.y - (this._parentCoords?.y ?? 0)) / this._options.zoom,
      width: rect.width,
      height: rect.height,
    }
  }  
}