import Selectable from './selectable';

type Coord = { x: number, y :number };

type Move<T extends HTMLElement> = {
  item: T;
  newPosition: Coord,
  totalDiff: Coord,
  lastDiff: Coord,
}

const pos0 = () => ({ x: 0, y: 0 });

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
};

export default class Moveable<MoveableType extends HTMLElement> extends EventTarget {
  private _isMoving = false;
  
  private _area: HTMLElement;  
  private _moveableItems: MoveableType[];
  
  private _zoomFactor: number = 1;

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
  }

  updateOption(options: MoveableMutableOption) {
    this._zoomFactor = options.zoom ?? 1;
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
      x: (e.clientX - this._moveStart.x) / this._zoomFactor,
      y: (e.clientY - this._moveStart.y) / this._zoomFactor,
    };

    return {
      totalDiff,
      lastDiff: {
        x: (e.clientX - this._moveLast.x) / this._zoomFactor,
        y: (e.clientY - this._moveLast.y) / this._zoomFactor,
      },
      newPosition: {
        x: itemStartCoord.x + totalDiff.x,
        y: itemStartCoord.y + totalDiff.y
      }
    };
  }
}