import Selectable from './selectable';

type Coord = { x: number, y :number };

type Move<T extends HTMLElement> = {
  item: T;
  newPosition: Coord,
  totalDiff: Coord,
  lastDiff: Coord,
}

const pos0 = () => ({ x: 0, y: 0 });
const moveKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

export interface MoveStartEvent extends Event {
  readonly type: "movestart";
}

export interface MoveEvent<T extends HTMLElement> extends Event {
  readonly type: "move";
  detail: Move<T>[];
}

export interface MoveEndEvent<T extends HTMLElement> extends Event {
  readonly type: "moveend";
  detail: Move<T>[];
}

type MoveableOption<T extends HTMLElement> = MoveableMutableOption & {
  area: HTMLElement;
  moveables?: T[];
  selectable?: Selectable<T>;
};

type MoveableMutableOption = {
  zoom?: number;
  keyboardMoveGaps?: [number, number];
};

const defaultOptions: Required<MoveableMutableOption> = {
  zoom: 1,
  keyboardMoveGaps: [10, 40],
};

export default class Moveable<MoveableType extends HTMLElement> extends EventTarget {
  private _isMoving = false;
  
  private _area: HTMLElement;  
  private _moveableItems: MoveableType[];
  
  private _options: Required<MoveableMutableOption> = defaultOptions;

  // Data used during move
  private _moveStart: Coord = pos0();
  private _moveLast: Coord = pos0();
  private _movedItems: MoveableType[] = [];
  private _movedItemStart: Coord[] = [];

  // Support for Selectable, for moving multiple item at once
  private _selectable?: Selectable<MoveableType>;
  
  constructor(options: MoveableOption<MoveableType>) {
    super();

    this._area = options.area;
    this._moveableItems = options.moveables ?? [];
    this._selectable = options.selectable;
        
    this.updateOption(options);
    
    this._area.addEventListener('mousedown', this._startMove.bind(this));
    this._area.addEventListener('mousemove', this._performMove.bind(this));
    this._area.addEventListener('mouseup', this._releaseMove.bind(this));

    document.addEventListener('keydown', this._handleKeyboardAction.bind(this));
  }

  updateOption(options: MoveableMutableOption) {
    this._options = {
      ...this._options,
      ...options
    };
  }

  private _startMove(e: MouseEvent) {
    
    const target = e.target as MoveableType;
    if (e.target && this._moveableItems.includes(target)) {

      // Prevent selection when moving item arround...
      this._selectable?.stopSelection();

      this._moveStart = { x: e.clientX, y: e.clientY };
      this._moveLast = { x: e.clientX, y: e.clientY };
      this._movedItemStart = [];

      if (!this._selectable) {
        this._movedItems = [target];
      } else {
        this._movedItems = [...this._selectable.getSelection()];
      }

      for( const item of this._movedItems) {
        const itemStyle = getComputedStyle(item);
        this._movedItemStart.push({
          x: parseFloat(itemStyle.left),
          y: parseFloat(itemStyle.top),
        });
      }

      this._isMoving = true;

      this.dispatchEvent(
        new CustomEvent("movestart") as MoveStartEvent,
      );
    }
  }

  private _performMove(e: MouseEvent) {
    if (this._isMoving) {     
      
      const detail: Move<MoveableType>[] = [];
      
      for (let i = 0; i < this._movedItems.length; i++) {

        const { totalDiff, lastDiff, newPosition } = this._computeMoveData(e, this._movedItemStart[i]);

        detail.push({
          item: this._movedItems[i],
          newPosition,
          totalDiff,
          lastDiff
        });
      }
        
      this._moveLast = { x: e.clientX, y: e.clientX };
      this.dispatchEvent(
        new CustomEvent("move", { detail }) as MoveEvent<MoveableType>,
      );
    }
  }

  private _releaseMove(e: MouseEvent) {
    if (this._isMoving) {

      const detail: Move<MoveableType>[] = [];
      
      for (let i = 0; i < this._movedItems.length; i++) {

        const { totalDiff, lastDiff, newPosition } = this._computeMoveData(e, this._movedItemStart[i]);

        detail.push({
          item: this._movedItems[i],
          newPosition,
          totalDiff,
          lastDiff
        });
      }
      const evt = new CustomEvent("moveend", { detail }) as MoveEndEvent<MoveableType>;

      this._moveStart = this._moveLast = pos0();
      this._movedItemStart = [];
      this._movedItems = [];
      this._isMoving = false;

      this.dispatchEvent(evt);
    }
  }

  private _computeMoveData(e: MouseEvent, itemStartCoord: Coord) {
    const totalDiff = {
      x: (e.clientX - this._moveStart.x) / this._options.zoom,
      y: (e.clientY - this._moveStart.y) / this._options.zoom,
    };

    return {
      totalDiff,
      lastDiff: {
        x: (e.clientX - this._moveLast.x) / this._options.zoom,
        y: (e.clientY - this._moveLast.y) / this._options.zoom,
      },
      newPosition: {
        x: itemStartCoord.x + totalDiff.x,
        y: itemStartCoord.y + totalDiff.y
      }
    };
  }

  private _handleKeyboardAction(e: KeyboardEvent) {
    const selection = this._selectable?.getSelection();

    // Keyboard move is only available when selectable is set & there's a selection
    if (selection?.length && moveKeys.includes(e.key)) {
      
      e.preventDefault();

      this.dispatchEvent(new CustomEvent("movestart") as MoveStartEvent);

      const moveFactor = e.shiftKey ? this._options.keyboardMoveGaps[1] : this._options.keyboardMoveGaps[0];
      const moveAxis = ['ArrowLeft', 'ArrowRight'].includes(e.key) ? 'x' : 'y';
      const moveDirection = ['ArrowDown', 'ArrowRight'].includes(e.key) ? 1 : -1;


      const detail: Move<MoveableType>[] = [];
      
      for (let i = 0; i < selection.length; i++) {

        // Total & last diff are the same for keyboard move. A move by keyboard is a "standalone" move workflow (start, move & end)
        const diff = pos0();
        diff[moveAxis] += moveFactor * moveDirection;

        const itemStyle = getComputedStyle(selection[i]);
        const newPosition = {
          x: parseFloat(itemStyle.left),
          y: parseFloat(itemStyle.top),
        };
        newPosition[moveAxis] += moveFactor * moveDirection;

        detail.push({
          item: selection[i],
          newPosition,
          totalDiff: diff,
          lastDiff: diff
        });
      }

      this.dispatchEvent(new CustomEvent("move", { detail }) as MoveEvent<MoveableType>);
      this.dispatchEvent(new CustomEvent("moveend", { detail }) as MoveEndEvent<MoveableType>);
    }
  }
}