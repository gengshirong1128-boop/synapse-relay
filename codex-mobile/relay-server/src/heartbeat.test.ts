import { describe, it, expect } from 'vitest';
import { evaluateHeartbeat } from './heartbeat';

describe('evaluateHeartbeat', () => {
  it('keeps a client alive and resets when a ping arrived (isAlive=true)', () => {
    const d = evaluateHeartbeat({ isAlive: true, missedHeartbeats: 0 });
    expect(d.terminate).toBe(false);
    expect(d.next).toEqual({ isAlive: false, missedHeartbeats: 0 });
  });

  it('does NOT terminate on the first missed beat (tolerates tunnel latency)', () => {
    const d = evaluateHeartbeat({ isAlive: false, missedHeartbeats: 0 });
    expect(d.terminate).toBe(false);
    expect(d.next.missedHeartbeats).toBe(1);
  });

  it('terminates on the second consecutive missed beat', () => {
    const d = evaluateHeartbeat({ isAlive: false, missedHeartbeats: 1 });
    expect(d.terminate).toBe(true);
    expect(d.next.missedHeartbeats).toBe(2);
  });

  it('a late ping after one miss rescues the connection', () => {
    // miss once...
    let s = evaluateHeartbeat({ isAlive: false, missedHeartbeats: 0 }).next;
    expect(s.missedHeartbeats).toBe(1);
    // ...then a ping lands (isAlive flipped true by the message handler)
    const d = evaluateHeartbeat({ isAlive: true, missedHeartbeats: s.missedHeartbeats });
    expect(d.terminate).toBe(false);
    expect(d.next.missedHeartbeats).toBe(0);
  });

  it('respects a custom maxMissed threshold', () => {
    expect(evaluateHeartbeat({ isAlive: false, missedHeartbeats: 2 }, 4).terminate).toBe(false);
    expect(evaluateHeartbeat({ isAlive: false, missedHeartbeats: 3 }, 4).terminate).toBe(true);
  });
});
