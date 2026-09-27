/**
 * StateMachine.ts — machine à états finis générique, synchrone et typée.
 *
 * Utilisée pour l'état global du jeu (titre → chapitre → pause → épilogue),
 * pour Turpal (repos, marche, escalade, contemplation) et pour les mécanismes.
 * Une transition invalide n'est jamais une exception : c'est un refus silencieux
 * et observable — le jeu ne punit pas, même son code.
 */

export interface TransitionEvent<S extends string> {
  readonly from: S;
  readonly to: S;
}

export interface StateDefinition<S extends string, C = void> {
  /** États atteignables depuis celui-ci. Liste vide = état terminal. */
  readonly to: readonly S[];
  readonly onEnter?: (context: C, event: TransitionEvent<S>) => void;
  readonly onExit?: (context: C, event: TransitionEvent<S>) => void;
  readonly onUpdate?: (context: C, delta: number) => void;
}

export type StateChart<S extends string, C = void> = Readonly<Record<S, StateDefinition<S, C>>>;

export interface StateMachineOptions<S extends string, C = void> {
  readonly chart: StateChart<S, C>;
  readonly initial: S;
  readonly context: C;
  readonly onTransition?: (event: TransitionEvent<S>) => void;
}

export class StateMachine<S extends string, C = void> {
  private current: S;
  private readonly chart: StateChart<S, C>;
  private readonly context: C;
  private readonly onTransition: ((event: TransitionEvent<S>) => void) | undefined;
  private readonly visited: S[] = [];

  constructor(options: StateMachineOptions<S, C>) {
    this.chart = options.chart;
    this.context = options.context;
    this.onTransition = options.onTransition;
    this.current = options.initial;
    this.visited.push(options.initial);

    const initialDef = this.chart[options.initial];
    initialDef.onEnter?.(this.context, { from: options.initial, to: options.initial });
  }

  get state(): S {
    return this.current;
  }

  /** Historique des états traversés, du plus ancien au plus récent. */
  get history(): readonly S[] {
    return this.visited;
  }

  is(state: S): boolean {
    return this.current === state;
  }

  can(state: S): boolean {
    return this.chart[this.current].to.includes(state);
  }

  /** Tente une transition. Retourne false si elle n'est pas autorisée. */
  transition(to: S): boolean {
    if (!this.can(to)) return false;

    const from = this.current;
    const event: TransitionEvent<S> = { from, to };

    this.chart[from].onExit?.(this.context, event);
    this.current = to;
    this.visited.push(to);
    this.chart[to].onEnter?.(this.context, event);
    this.onTransition?.(event);
    return true;
  }

  /** Fait avancer la logique de l'état courant. */
  update(delta: number): void {
    this.chart[this.current].onUpdate?.(this.context, delta);
  }
}

/** États globaux du jeu. */
export type GameState =
  'boot' | 'title' | 'loading' | 'playing' | 'solved' | 'paused' | 'chapterCard' | 'epilogue';
