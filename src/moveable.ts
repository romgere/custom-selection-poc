import './style.css';

type Coord = { x: number, y :number };

type Move<T = unknown> = {
  item: T;
  newPosition: Coord,
  totalDiff: Coord,
  lastDiff: Coord,
}

const pos0 = { x: 0, y: 0 };

export interface MoveStartEvent extends Event {
  readonly type: "movestart";
}

export interface MoveEvent<T> extends Event {
  readonly type: "move";
  detail: Move<T>;
}

export interface MoveEndEvent<T> extends Event {
  readonly type: "moveend";
  detail: Move<T>;
}

type MoveableOption<T> = MoveableUpdatableOption & {
  area: HTMLElement;
  moveables?: T[];
};

type MoveableUpdatableOption = {
  zoom?: number;
};

export default class Moveable<MoveableType extends HTMLElement> extends EventTarget {
  private _isMoving = false;
  
  private _area: HTMLElement;  
  private _moveableItems: MoveableType[];
  
  private _zoomFactor: number = 1;

  // Data used during move
  private _moveStart: Coord = pos0;
  private _moveLast: Coord = pos0;
  private _movedItem?: MoveableType;
  private _movedItemStart: Coord = pos0;
  
  constructor(options: MoveableOption<MoveableType>) {
    super();

    this._area = options.area;
    this._moveableItems = options.moveables ?? [];
        
    this.updateOption(options);
    
    this._area.addEventListener('mousedown', this._startMove.bind(this));
    this._area.addEventListener('mousemove', this._performMove.bind(this));
    this._area.addEventListener('mouseup', this._releaseMove.bind(this));
  }

  updateOption(options: MoveableUpdatableOption) {
    this._zoomFactor = options.zoom ?? 1;
  }

  private _startMove(e: MouseEvent) {
    
    const target = e.target as MoveableType;
    if (e.target && this._moveableItems.includes(target)) {
      this._moveStart = { x: e.clientX, y: e.clientY };
      this._moveLast = { x: e.clientX, y: e.clientY };
      this._movedItem = target;

      const itemStyle = getComputedStyle(target);
      this._movedItemStart = {
        x: parseFloat(itemStyle.left),
        y: parseFloat(itemStyle.top),
      }

      this._isMoving = true;

      this.dispatchEvent(
        new CustomEvent("movestart") as MoveStartEvent,
      );
    }
  }

  private _performMove(e: MouseEvent) {
    if (this._isMoving) {      
      const { totalDiff, lastDiff, newPosition } = this._computeMoveData(e);

      this.dispatchEvent(
        new CustomEvent("move", {
          detail: {
            item: this._movedItem,
            newPosition,
            totalDiff,
            lastDiff
          }
        }) as MoveEvent<MoveableType>,
      );

      this._moveLast = { x: e.clientX, y: e.clientX };
    }
  }

  private _releaseMove(e: MouseEvent) {
    if (this._isMoving) {
      const { totalDiff, lastDiff, newPosition } = this._computeMoveData(e);

      const evt = new CustomEvent("moveend", {
        detail: {
          item: this._movedItem,
          newPosition,
          totalDiff,
          lastDiff
        }
      }) as MoveEndEvent<MoveableType>;

      this._moveStart = this._moveLast = this._movedItemStart = pos0;
      this._movedItem = undefined;
      this._isMoving = false;

      this.dispatchEvent(evt);
    }
  }

  private _computeMoveData(e: MouseEvent) {
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
        x: this._movedItemStart.x + totalDiff.x,
        y: this._movedItemStart.y + totalDiff.y
      }
    };
  }


}