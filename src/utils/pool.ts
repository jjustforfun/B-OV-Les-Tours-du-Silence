/**
 * pool.ts — pool d'objets générique.
 *
 * Le ramasse-miettes est l'ennemi du 60 fps stable sur mobile : un hoquet de
 * 12 ms se voit. Particules, vecteurs temporaires et nœuds de pathfinding
 * passent par un pool plutôt que par `new` à chaque image.
 */
export interface PoolOptions<T> {
  readonly create: () => T;
  readonly reset?: (item: T) => void;
  readonly initialSize?: number;
  readonly maxSize?: number;
}

export class Pool<T> {
  private readonly items: T[] = [];
  private readonly create: () => T;
  private readonly reset: ((item: T) => void) | undefined;
  private readonly maxSize: number;
  private borrowed = 0;

  constructor(options: PoolOptions<T>) {
    this.create = options.create;
    this.reset = options.reset;
    this.maxSize = options.maxSize ?? 1024;
    for (let i = 0; i < (options.initialSize ?? 0); i += 1) {
      this.items.push(this.create());
    }
  }

  get size(): number {
    return this.items.length;
  }

  get inUse(): number {
    return this.borrowed;
  }

  acquire(): T {
    this.borrowed += 1;
    const item = this.items.pop();
    return item ?? this.create();
  }

  release(item: T): void {
    this.borrowed = Math.max(0, this.borrowed - 1);
    if (this.items.length >= this.maxSize) return;
    this.reset?.(item);
    this.items.push(item);
  }

  clear(): void {
    this.items.length = 0;
    this.borrowed = 0;
  }
}
