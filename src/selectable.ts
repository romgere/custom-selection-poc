import {
  testPolygoneCollision,
  rotate,
  pos0,
  rect0,
  getAngleFromTransform
} from './utils'
import type {
  Coord,
  Rect,
  Polygone
} from './utils'

type ItemPolygone<T> = { item: T, polygone: Polygone, rotation: boolean}

const multiSelectionKeys = ['Meta', 'Control', 'Shift'];
const keyboardSelectionCodes = ['Enter', 'Space'];

type SelectableOption<T> = SelectableMutableOption & {
  area: HTMLElement;
  selectionFeebackContainer?: HTMLElement
  selectables?: T[];
};

type SelectableMutableOption = {
  zoom?: number;
};

const defaultOptions: Required<SelectableMutableOption> = {
  zoom: 1,
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
  private _isMouseSelectionInit = false;
  
  private _area: HTMLElement;

  private _selectionFeebackContainer: HTMLElement
  private _selectionFeedback: HTMLDivElement; 
  
  private _selectionStart: Coord = pos0();
  private _selectionRect: Rect = rect0();
  private _containerInitialPosition : Coord = pos0(); // Track eventual scrolling during selection

  private _selectableItems: SelectableType[];
  private _selection: SelectableType[] = [];
  private _selectableItemsPolygones: ItemPolygone<SelectableType>[] = [];

  private _options: Required<SelectableMutableOption> = defaultOptions;

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

    document.addEventListener('keydown', (e: KeyboardEvent) => this._handleKeyboardAction(e, true));
    document.addEventListener('keyup', (e: KeyboardEvent) => this._handleKeyboardAction(e, false));
  }

  updateOption(options: SelectableMutableOption) {
    this._options = {
      ...this._options,
      ...options
    };
  }

  getSelection(): SelectableType[] {
    return this._selection;
  }

  setSelection(newSelection:SelectableType[], triggerChangeEvent = true) {

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
      this._selectSingleItem(target);      
    } else if (!this._multiSelection && this._selection.length) {
      // "Classic click" (not multiple selection) outside of any selectable, clear the selection
      this.setSelection([]);
    }

    this._selectionStart = { x: e.clientX, y: e.clientY };
    this._selectionRect = {...this._selectionStart, width: 0, height: 0 };
    this._selectionOriginalSelection = [...this._selection];    

    const areaRect = this._area.getBoundingClientRect();
    this._containerInitialPosition = { x: areaRect.left, y: areaRect.top };

    // We used to compute selectable polygone & update UI here, but given it's a costly operation,
    // and the "_startSelection" is trigger even for single click select, it has been move into _performSelection, on first call
    this._isMouseSelectionInit = false;
    this._isSelecting = true;
    
    this.dispatchEvent(
      new CustomEvent("selectionstart") as SelectionStartEvent,
    );
  };

  // Update selection area & compute Selection
  private _performSelection(e: MouseEvent) {
    if (this._isSelecting) {

      // Compute selectable element Polygones once for all at start (they are not supposed to move during the selection)
      if (!this._isMouseSelectionInit) {
        this._computeSelectablePolygones();            
        this._updateSelectionFeedback();
        this._selectionFeedback.style.display = "";
        this._isMouseSelectionInit = true;
      }

      // Detect scrolling during selection
      const areaRect = this._area.getBoundingClientRect()
      const scrollTranslate = {
        x: areaRect.left - this._containerInitialPosition.x,
        y: areaRect.top - this._containerInitialPosition.y
      };
      
      const x1 = Math.min(this._selectionStart.x + scrollTranslate.x, e.clientX);
      const y1 = Math.min(this._selectionStart.y + scrollTranslate.y, e.clientY);
      const x2 = Math.max(this._selectionStart.x + scrollTranslate.x, e.clientX);
      const y2 = Math.max(this._selectionStart.y + scrollTranslate.y, e.clientY);

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
      let newSelection = this._computeSelection(scrollTranslate);

      
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

  private _selectSingleItem(item: SelectableType) {
    if (this._selection.includes(item)) {
      if (this._multiSelection) {
        // Remove item from selection
        this.setSelection(this._selection.filter(i => i !== item));
      }
    } else {
      if (this._multiSelection) {
        // Add item to selection
        this.setSelection([...this._selection, item]);
      }
      else {
        // Single selection
        this.setSelection([item]);
      }
    }
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

  private _handleKeyboardAction(e: KeyboardEvent, keydown: boolean) {    
    
    if (multiSelectionKeys.includes(e.key)) {
        this._multiSelection = keydown;
    }
    else if (!keydown && keyboardSelectionCodes.includes(e.code) && document.activeElement && this._selectableItems.includes(document.activeElement as SelectableType)) {
      this._selectSingleItem(document.activeElement as SelectableType);
    }
  }

  // This update the selection rect according to (new) selection start/end position
  private _updateSelectionFeedback() {

    // Selection feedback is the only element that is affected by zoom or parent position,    
    // we need to compute selection area position/size according to its container position & current zoom.
    // (selection logic is perform by using absolute position/size of selectable item & selection rect, no need to perform zoom/repositionning on this part).
    const containerRect = this._selectionFeebackContainer.getBoundingClientRect()

              
    const x = (this._selectionRect.x - containerRect.left) / this._options.zoom;
    const y = (this._selectionRect.y - containerRect.top) / this._options.zoom;
    const width = this._selectionRect.width / this._options.zoom;
    const height = this._selectionRect.height / this._options.zoom;

    this._selectionFeedback.style.left = `${x}px`;
    this._selectionFeedback.style.top = `${y}px`;
    this._selectionFeedback.style.width = `${width}px`;
    this._selectionFeedback.style.height = `${height}px`;
  }

  // This compute polygones for all selectable elements
  private _computeSelectablePolygones() {

    this._selectableItemsPolygones = [...this._selectableItems].map<ItemPolygone<SelectableType>>((i) => {

      const angle = getAngleFromTransform(i.style.transform);

      
      if (!angle) {
        const rect = i.getBoundingClientRect();
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

      // Here we compute the "viewport relative" position & size of the rotated item
      const parentRect = i.parentElement?.getBoundingClientRect();
      const parentCoord = parentRect ? { x: parentRect.left, y: parentRect.top } : pos0();

      const rect = {
        x: i.offsetLeft * this._options.zoom + parentCoord.x,
        y: i.offsetTop * this._options.zoom + parentCoord.y,
        width: i.offsetWidth * this._options.zoom,
        height: i.offsetHeight * this._options.zoom
      }
      
      const center: Coord = {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      };

      // Compute rotated vertice
      const rectBounds: Polygone = [
        rotate({ x: rect.x, y: rect.y }, center, -angle), // tl
        rotate({ x: rect.x + rect.width, y: rect.y }, center, -angle), // tr
        rotate({ x: rect.x + rect.width, y: rect.y + rect.height }, center, -angle), // br
        rotate({ x: rect.x, y: rect.y + rect.height }, center, -angle), // bl
      ];

      return {
        item: i,
        rotation: true,
        polygone: rectBounds
      };
    });
  }

  private _translatePolygone(p: Polygone, translate: Coord) {
    return p.map(({x, y}) => ({
      x: x + translate.x,
      y: y + translate.y,
    }));
  }

  private _computeSelection(scrollValues: Coord) {
    const selectionPoly: Polygone = [
      { x: this._selectionRect.x, y: this._selectionRect.y }, // tl
      { x: this._selectionRect.x + this._selectionRect.width, y: this._selectionRect.y }, // tr
      { x: this._selectionRect.x + this._selectionRect.width, y: this._selectionRect.y+ this._selectionRect.height }, // br
      { x: this._selectionRect.x, y: this._selectionRect.y + this._selectionRect.height }, // bl
    ];

    return this._selectableItemsPolygones.filter((i) => {      
      return testPolygoneCollision(selectionPoly, this._translatePolygone(i.polygone, scrollValues));
    }).map(i => i.item);
  }
}
