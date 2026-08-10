import { describe, it, expect } from "vitest";
import { pickWinners, type Entrant, drawRaffleWinners } from "@/lib/raffle-draw";
import { WEEKLY_WINNER_COUNT } from "@/lib/raffle-week";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("pickWinners", () => {
  it("returns exactly `count` winners when the pool is large enough", () => {
    const entrants: Entrant[] = Array.from({ length: 20 }, (_, i) => ({
      userId: `user-${i}`,
      tickets: i + 1,
    }));
    const winners = pickWinners(entrants, 5);
    expect(winners).toHaveLength(5);
  });

  it("returns at most the number of eligible entrants when the pool is smaller than count", () => {
    const entrants: Entrant[] = [
      { userId: "a", tickets: 3 },
      { userId: "b", tickets: 1 },
    ];
    const winners = pickWinners(entrants, WEEKLY_WINNER_COUNT);
    expect(winners).toHaveLength(2);
  });

  it("returns no winners when there are no eligible entrants", () => {
    expect(pickWinners([], 5)).toHaveLength(0);
  });

  it("never picks the same entrant twice (selection without replacement)", () => {
    const entrants: Entrant[] = Array.from({ length: 50 }, (_, i) => ({
      userId: `user-${i}`,
      tickets: 1 + (i % 7),
    }));
    for (let trial = 0; trial < 200; trial++) {
      const winners = pickWinners(entrants, 5);
      expect(new Set(winners).size).toBe(winners.length);
    }
  });

  it("only ever selects entrants with a positive ticket count", () => {
    const entrants: Entrant[] = [
      { userId: "zero", tickets: 0 },
      { userId: "negative", tickets: -5 },
      { userId: "eligible-1", tickets: 10 },
      { userId: "eligible-2", tickets: 10 },
    ];
    for (let trial = 0; trial < 100; trial++) {
      const winners = pickWinners(entrants, 5);
      expect(winners).not.toContain("zero");
      expect(winners).not.toContain("negative");
    }
    // With only two eligible entrants, asking for more winners than that
    // must not pad the result with ineligible ones.
    const winners = pickWinners(entrants, 5);
    expect(winners.sort()).toEqual(["eligible-1", "eligible-2"]);
  });

  it("weights selection probability proportionally to ticket count", () => {
    // 1000 tickets total: entrant "heavy" should win roughly 10x as often as
    // "light" over enough trials. This is inherently statistical, so the
    // tolerance is generous to avoid flaking while still catching a
    // fundamentally broken (e.g. uniform-random) implementation.
    const entrants: Entrant[] = [
      { userId: "heavy", tickets: 900 },
      { userId: "light", tickets: 100 },
    ];
    const trials = 20_000;
    let heavyWins = 0;
    for (let i = 0; i < trials; i++) {
      const [winner] = pickWinners(entrants, 1);
      if (winner === "heavy") heavyWins++;
    }
    const observedRate = heavyWins / trials;
    // Expected 0.9; allow +/- 0.03 for sampling noise.
    expect(observedRate).toBeGreaterThan(0.87);
    expect(observedRate).toBeLessThan(0.93);
  });
});

// Minimal fake for the subset of the Supabase query-builder chain that
// drawRaffleWinners actually calls, so the DB-orchestration logic (atomic
// claim, entry aggregation, redraw prevention) can be tested without a real
// database. Every terminal call resolves through `handler`, which test
// cases use to script table-specific responses and record calls.
type ChainState = {
  table: string;
  type?: "update" | "insert" | "select";
  payload?: Record<string, unknown>;
  filters: Record<string, unknown>;
};
type ChainResult = { data: unknown; error: unknown };
type Handler = (state: ChainState) => ChainResult;

type FakeChain = {
  update(payload: Record<string, unknown>): FakeChain;
  insert(payload: Record<string, unknown>): FakeChain;
  select(cols?: string): FakeChain;
  eq(col: string, val: unknown): FakeChain;
  maybeSingle(): Promise<ChainResult>;
  then<T>(
    onFulfilled: (v: ChainResult) => T,
    onRejected?: (e: unknown) => T
  ): Promise<T>;
};

function createFakeSupabase(handler: Handler): SupabaseClient {
  function makeChain(table: string): FakeChain {
    const state: ChainState = { table, filters: {} };
    const chain: FakeChain = {
      update(payload) {
        state.type = "update";
        state.payload = payload;
        return chain;
      },
      insert(payload) {
        state.type = "insert";
        state.payload = payload;
        return chain;
      },
      select() {
        if (!state.type) state.type = "select";
        return chain;
      },
      eq(col, val) {
        state.filters[col] = val;
        return chain;
      },
      maybeSingle() {
        return Promise.resolve(handler(state));
      },
      then(onFulfilled, onRejected) {
        return Promise.resolve(handler(state)).then(onFulfilled, onRejected);
      },
    };
    return chain;
  }
  return { from: (table: string) => makeChain(table) } as unknown as SupabaseClient;
}

describe("drawRaffleWinners", () => {
  it("does not redraw a raffle that is already completed (or otherwise not open)", async () => {
    const insertCalls: unknown[] = [];
    const supabase = createFakeSupabase((state) => {
      if (state.table === "raffles" && state.type === "update" && state.payload?.status === "drawing") {
        // The CAS `UPDATE ... WHERE status = 'open'` matches zero rows
        // because the raffle is already completed -- Postgres/Supabase
        // returns null data for maybeSingle in that case.
        return { data: null, error: null };
      }
      if (state.table === "raffle_winners" && state.type === "insert") {
        insertCalls.push(state.payload);
      }
      return { data: null, error: null };
    });

    const result = await drawRaffleWinners(supabase, "raffle-1");

    expect(result.drawn).toBe(false);
    expect(result.winnerIds).toHaveLength(0);
    expect(insertCalls).toHaveLength(0);
  });

  it("draws winners, credits each exactly once, and marks the raffle completed", async () => {
    const entries = [
      { user_id: "user-a", tickets_used: 10 },
      { user_id: "user-b", tickets_used: 5 },
      { user_id: "user-c", tickets_used: 0 }, // ineligible: zero tickets
      { user_id: "user-a", tickets_used: 3 }, // second row for same user -- must aggregate, not double-enter
    ];
    const winnerInserts: Record<string, unknown>[] = [];
    const raffleUpdates: Record<string, unknown>[] = [];

    const supabase = createFakeSupabase((state) => {
      if (state.table === "raffles" && state.type === "update") {
        raffleUpdates.push(state.payload ?? {});
        if (state.payload?.status === "drawing") {
          return { data: { id: "raffle-1", week_end: "2099-01-08T00:00:00.000Z" }, error: null };
        }
        return { data: { id: "raffle-1" }, error: null };
      }
      if (state.table === "raffle_entries" && state.type === "select") {
        return { data: entries, error: null };
      }
      if (state.table === "raffle_winners" && state.type === "insert") {
        winnerInserts.push(state.payload ?? {});
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });

    const result = await drawRaffleWinners(supabase, "raffle-1");

    expect(result.drawn).toBe(true);
    // Only 2 eligible entrants (user-a aggregated to 13 tickets, user-b to 5) exist.
    expect(result.winnerIds.sort()).toEqual(["user-a", "user-b"]);
    expect(new Set(result.winnerIds).size).toBe(result.winnerIds.length);
    expect(winnerInserts).toHaveLength(2);
    for (const insert of winnerInserts) {
      expect(["user-a", "user-b"]).toContain(insert.user_id);
      expect(insert.status).toBe("pending");
    }
    // Final status transition to completed.
    expect(raffleUpdates.some((u) => u.status === "completed")).toBe(true);
  });
});
