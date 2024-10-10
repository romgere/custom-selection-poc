import './style.css';

type Coord = { x: number, y :number };
type Rect = Coord & { width: number, height :number };
// Rectangle "Polygone" is array of vertices. ! WARNING ! "point in poly" method need vertice to be in a sequential order (clockwise or anti-clockwise) otherwise it won't work.
type Polygone = [Coord, Coord, Coord, Coord];

type ItemPolygone<T> = { item: T, polygone: Polygone, rotation: boolean}

const pos0 = () => ({ x: 0, y: 0 });
const rect0 = () => ({...pos0(), width: 0, height: 0 });

const multiSelectionKeys = ['Meta', 'Control', 'Shift'];

type SelectableOption<T> = SelectableMutableOption & {
  area: HTMLElement;
  selectionFeebackContainer?: HTMLElement
  selectables?: T[];
};

type SelectableMutableOption = {
  zoom?: number;
};

export interface SelectionStartEvent extends Event {
  readonly type: "selectionstart";
}

export interface SelectionChangeEvent<T> extends Event {
  readonly type: "selectionchange";
  detail: { selection: T[]; }
}

export interface SelectionEndEvent extends Event {
  readonly type: "selectionend";
}

export default class Selectable<SelectableType extends HTMLElement> extends EventTarget {
  private _isSelecting = false;
  
  private _area: HTMLElement;

  private _selectionFeebackContainer: HTMLElement
  private _selectionFeedback: HTMLDivElement; 
  
  private _selectionStart: Coord = pos0();
  private _selectionRect: Rect = rect0();

  private _selectableItems: SelectableType[];
  private _selection: SelectableType[] = [];
  private _selectableItemsPolygones: ItemPolygone<SelectableType>[] = [];

  private _zoomFactor: number = 1;

  // Multi selection
  private _multiSelection = false;
  private _selectionOriginalSelection: SelectableType[] = [];

  constructor(options: SelectableOption<SelectableType>) {
    super();

    this._area = options.area;
    this._selectableItems = options.selectables ?? [];
    this._selectionFeebackContainer = options.selectionFeebackContainer ?? options.area;

    // Create and add selection feedback (hidden)
    this._selectionFeedback = document.createElement('div');
    this._selectionFeedback.classList.add('selection-rect')
    this._selectionFeedback.style.display = "none";
    this._selectionFeebackContainer.prepend(this._selectionFeedback)
    
    this.updateOption(options);
    
    this._area.addEventListener('mousedown', this._startSelection.bind(this));
    this._area.addEventListener('mousemove', this._performSelection.bind(this));
    this._area.addEventListener('mouseup', this._releaseSelection.bind(this));    

    document.addEventListener('keydown', (e: KeyboardEvent) => this._handleSelectionModifier(e, true));
    document.addEventListener('keyup', (e: KeyboardEvent) => this._handleSelectionModifier(e, false));
  }

  updateOption(options: SelectableMutableOption) {
    this._zoomFactor = options.zoom ?? 1;
  }

  getSelection(): SelectableType[] {
    return this._selection;
  }

  setSelection(newSelection:SelectableType[], triggerChangeEvent = true) {
    console.log("newSelection", newSelection)

    if (triggerChangeEvent) {
      // Check if selection change & trigger event with new selection if needed
      let selectionChanged = this._selection.length !== newSelection.length
      || this._selection.find((i) => !newSelection.includes(i)) !== undefined
      || newSelection.find((i) => !this._selection.includes(i)) !== undefined
      
      if (selectionChanged) {
        this._selection = newSelection;
        this._triggerSelectionChange();
      }
    } else {
      this._selection = newSelection;
    }
  }

  addToSelection(items: SelectableType[], triggerChangeEvent = true) {
    const newSelected = this._selection.filter((i) => !items.includes(i));

    if (newSelected) {
      this._selection.push(...newSelected);
      if (triggerChangeEvent) {
        this._triggerSelectionChange();
      }
    }
  }

  removeFromSelection(items: SelectableType[], triggerChangeEvent = true) {
    const newSelection = this._selection.filter((i) => !items.includes(i));

    if (newSelection.length !== this._selection.length) {
      this._selection = newSelection;
      if (triggerChangeEvent) {
        this._triggerSelectionChange();
      }
    }
  }

  addSelectables(items: SelectableType[], addToSelection = false, triggerChangeEvent = true) {
    const newItems = this._selectableItems.filter((i) => !items.includes(i));

    this._selectableItems.push(...newItems);
    
    if (addToSelection) {
      this.addToSelection(items, triggerChangeEvent);
    }
  }

  removeSelectables(items: SelectableType[], removeFromSelection = true, triggerChangeEvent = true) {
    this._selectableItems = this._selectableItems.filter((i) => !items.includes(i));
    
    if (removeFromSelection) {
      this.removeFromSelection(items, triggerChangeEvent)
    }
  }

  stopSelection() {
    this._releaseSelection()
  }

  // Start selection mode, add selectionFeedback to DOM & compute selectable rect
  private _startSelection(e: MouseEvent) {

    const target = e.target as SelectableType;
    if (e.target && this._selectableItems.includes(target)) {
 
      if (this._selection.includes(target)) {
        if (this._multiSelection) {
          // Remove item from selection
          this.setSelection(this._selection.filter(i => i !== target));
        } else {
          // Multiple click on selected item has no effect
          return;
        }
      } else {
        if (this._multiSelection) {
          // Add item to selection
          this.setSelection([...this._selection, target]);
        }
        else {
          // Single selection
          this.setSelection([target]);
        }
      }
    } else if (!this._multiSelection && this._selection.length) {
      // "Classic click" (not multiple selection) outside of any selectable, clear the selection
      this.setSelection([]);
    }

    this._selectionStart = { x: e.clientX, y: e.clientY };
    this._selectionRect = {...this._selectionStart, width: 0, height: 0 };
    this._selectionOriginalSelection = [...this._selection];

    // Compute selectable element Polygones once for all at start (they are not supposed to move during the selection)
    this._computeSelectablePolygones();
    
    this._updateSelectionFeedback();

    this._selectionFeedback.style.display = "";

    this._isSelecting = true;

    this.dispatchEvent(
      new CustomEvent("selectionstart") as SelectionStartEvent,
    );
  };

  // Update selection area & compute Selection
  private _performSelection(e: MouseEvent) {
    if (this._isSelecting) {
      const x1 = Math.min(this._selectionStart.x, e.clientX);
      const y1 = Math.min(this._selectionStart.y, e.clientY);
      const x2 = Math.max(this._selectionStart.x, e.clientX);
      const y2 = Math.max(this._selectionStart.y, e.clientY);

      // This is pos/size of selection (absolute to document)
      this._selectionRect = {
        x: x1,
        y: y1,
        width: x2 - x1,
        height: y2 - y1
      };
      
      // Update Selection Rect DOM position & size
      this._updateSelectionFeedback();

      // Check what's inside new selection Rect
      let newSelection = this._computeSelection();

      
      if (this._multiSelection) {        
        newSelection = [
            // Keeps what was in original selection if not selected in current "selection session"
            ...this._selectionOriginalSelection.filter(i => !newSelection.includes(i)),
            // Remove from current "selection session" what was in original selection
            ...newSelection.filter(i => !this._selectionOriginalSelection.includes(i)),
        ];
      }

      this.setSelection(newSelection)
    }
  }

  private _triggerSelectionChange() {
    this.dispatchEvent(
      new CustomEvent("selectionchange", {
        detail: { selection:  [...this._selection] }
      }) as SelectionChangeEvent<SelectableType>,
    );
  }

  // Stop Selection & get rid of selectionFeedback
  private _releaseSelection() {
    if (this._isSelecting) {
      this._selectionFeedback.style.display = "none";
      this._selectionStart = pos0();
      this._selectionRect = rect0();

      this._isSelecting = false; 

      this.dispatchEvent(
        new CustomEvent("selectionend") as SelectionEndEvent,
      );
    }
  }

  private _handleSelectionModifier(e: KeyboardEvent, keydown: boolean) {    
    if (multiSelectionKeys.includes(e.key)) {
        this._multiSelection = keydown;
    }
  }


  // This update the selection rect according to (new) selection start/end position
  private _updateSelectionFeedback() {

    // Selection feedback is the only element that is affect by zoom or parent position,    
    // we need to compute selection area postition/size according to its container.
    // Selection logic is perform by using absolute position/size of selectable item & selection rect.
    const containerRect = this._selectionFeebackContainer.getBoundingClientRect()

              
    const x = (this._selectionRect.x - containerRect.left) / this._zoomFactor;
    const y = (this._selectionRect.y - containerRect.top) / this._zoomFactor;
    const width = this._selectionRect.width / this._zoomFactor;
    const height = this._selectionRect.height / this._zoomFactor;

    this._selectionFeedback.style.left = `${x}px`;
    this._selectionFeedback.style.top = `${y}px`;
    this._selectionFeedback.style.width = `${width}px`;
    this._selectionFeedback.style.height = `${height}px`;
  }

  // This compute polygones for all selectable elements
  private _computeSelectablePolygones() {

    this._selectableItemsPolygones = [...this._selectableItems].map<ItemPolygone<SelectableType>>((i) => {

      // Extract rotation value from css (todo: refactor this)
      const angle = i.style.transform.includes('rotate') ? parseInt(i.style.transform.replace('rotate(', '').replace('deg)', '')) : 0;

      let rect = i.getBoundingClientRect();

      if (!angle) {
        return {
          item:i ,
          rotation: false,
          polygone: [
            { x: rect.left, y: rect.top }, // tl
            { x: rect.right, y: rect.top }, // tr
            { x: rect.right, y: rect.bottom }, // br
            { x: rect.left, y: rect.bottom }, // bl
          ]
        }
      }

      // Here we need to find the absolute position & size of the rotated item
      // easy solution is to crate a "clone" item (that have same x,y, width & height) but without rotation
      const computedstyle = getComputedStyle(i);

      const tempClone = document.createElement('div');
      tempClone.style.left = computedstyle.left;
      tempClone.style.top = computedstyle.top;
      tempClone.style.width = computedstyle.width;
      tempClone.style.height = computedstyle.height;
      tempClone.style.position = computedstyle.position;

      i.parentElement?.append(tempClone);

      rect = tempClone.getBoundingClientRect();

      tempClone.remove();

      const center: Coord = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };

      // Compute rotated vertice
      const rectBounds: Polygone = [
        rotate({ x: rect.left, y: rect.top }, center, -angle), // tl
        rotate({ x: rect.right, y: rect.top }, center, -angle), // tr
        rotate({ x: rect.right, y: rect.bottom }, center, -angle), // br
        rotate({ x: rect.left, y: rect.bottom }, center, -angle), // bl
      ];

      return {
        item: i,
        rotation: true,
        polygone: rectBounds
      };
    });
  }

  private _computeSelection() {
    const selectionPoly: Polygone = [
      { x: this._selectionRect.x, y: this._selectionRect.y }, // tl
      { x: this._selectionRect.x + this._selectionRect.width, y: this._selectionRect.y }, // tr
      { x: this._selectionRect.x + this._selectionRect.width, y: this._selectionRect.y+ this._selectionRect.height }, // br
      { x: this._selectionRect.x, y: this._selectionRect.y + this._selectionRect.height }, // bl
    ];

    return this._selectableItemsPolygones.filter((i) => {
            
      // Does not waste time with complex math when item is not rotated
      if (!i.rotation && testSimpleRectCollision(selectionPoly, i.polygone)) {
        return true;
      }
      else if (i.rotation && testPolygoneCollision(selectionPoly, i.polygone)) {
        return true;
      } 
      return false;
    }).map(i => i.item);
  }
}


////////////////////////////////////
// Move to math-utils.ts
function testSimpleRectCollision(rect1: Polygone, rect2: Polygone) {

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


function pointInRect(point: Coord, poly: Polygone) {
  return point.x >= poly[0].x && point.x <= poly[1].x
    && point.y >= poly[0].y && point.y <= poly[2].y;
}


function testPolygoneCollision(rect1: Polygone, rect2: Polygone) {
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
// Move to math-utils.ts
////////////////////////////////////


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

// From report engine
/////////////////////////////////////////