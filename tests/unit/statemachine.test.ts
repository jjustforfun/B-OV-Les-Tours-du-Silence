/**
 * statemachine.test.ts — la machine à états doit refuser sans casser :
 * une transition invalide est un non-événement, jamais une exception.
 */
import { describe, expect, it, vi } from 'vitest';
import { StateMachine, type StateChart } from '@core/StateMachine';

type Door = 'closed' | 'opening' | 'open';

const chart: StateChart<Door> = {
  closed: { to: ['opening'] },
  opening: { to: ['open', 'closed'] },
  open: { to: [] },
};

describe('StateMachine', () => {
  it('démarre dans l’état initial', () => {
    const machine = new StateMachine<Door>({ chart, initial: 'closed', context: undefined });
    expect(machine.state).toBe('closed');
    expect(machine.is('closed')).toBe(true);
  });

  it('autorise les transitions déclarées', () => {
    const machine = new StateMachine<Door>({ chart, initial: 'closed', context: undefined });
    expect(machine.can('opening')).toBe(true);
    expect(machine.transition('opening')).toBe(true);
    expect(machine.state).toBe('opening');
  });

  it('refuse silencieusement les transitions non déclarées', () => {
    const machine = new StateMachine<Door>({ chart, initial: 'closed', context: undefined });
    expect(machine.transition('open')).toBe(false);
    expect(machine.state).toBe('closed');
  });

  it('appelle onExit puis onEnter dans l’ordre', () => {
    const calls: string[] = [];
    const tracked: StateChart<Door> = {
      closed: { to: ['opening'], onExit: () => calls.push('exit:closed') },
      opening: { to: ['open'], onEnter: () => calls.push('enter:opening') },
      open: { to: [] },
    };

    const machine = new StateMachine<Door>({
      chart: tracked,
      initial: 'closed',
      context: undefined,
    });
    machine.transition('opening');
    expect(calls).toEqual(['exit:closed', 'enter:opening']);
  });

  it('notifie onTransition', () => {
    const onTransition = vi.fn();
    const machine = new StateMachine<Door>({
      chart,
      initial: 'closed',
      context: undefined,
      onTransition,
    });

    machine.transition('opening');
    expect(onTransition).toHaveBeenCalledWith({ from: 'closed', to: 'opening' });
  });

  it('propage le contexte à onUpdate', () => {
    const context = { ticks: 0 };
    const counting: StateChart<Door, typeof context> = {
      closed: { to: ['opening'], onUpdate: (ctx, delta) => (ctx.ticks += delta) },
      opening: { to: ['open'] },
      open: { to: [] },
    };

    const machine = new StateMachine<Door, typeof context>({
      chart: counting,
      initial: 'closed',
      context,
    });

    machine.update(0.5);
    machine.update(0.5);
    expect(context.ticks).toBe(1);
  });

  it('conserve l’historique des états', () => {
    const machine = new StateMachine<Door>({ chart, initial: 'closed', context: undefined });
    machine.transition('opening');
    machine.transition('open');
    expect(machine.history).toEqual(['closed', 'opening', 'open']);
  });

  it('considère un état sans sortie comme terminal', () => {
    const machine = new StateMachine<Door>({ chart, initial: 'closed', context: undefined });
    machine.transition('opening');
    machine.transition('open');
    expect(machine.can('closed')).toBe(false);
  });
});
