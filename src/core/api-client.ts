export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getJson<T>(baseUrl: string, path: string): Promise<T> {
  const url = new URL(path, baseUrl).toString();
  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError(`GET ${url} -> ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

async function postJson<T>(baseUrl: string, path: string, body: unknown): Promise<T> {
  const url = new URL(path, baseUrl).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new ApiError(`POST ${url} -> ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

export interface LeaderboardEntry {
  rank: number;
  playerAddress: string;
  score: string;
}

export interface QuestProgress {
  questId: string;
  progress: number;
  target: number;
  claimed: boolean;
  streak: number;
}

export interface TournamentSummary {
  tournamentId: string;
  gameId: string;
  status: "upcoming" | "active" | "finished";
  prizePool: string;
}

export interface FairnessProof {
  roundId: string;
  gameId: string;
  commitHash: string;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  ledgerHash: string;
  derivedValue: string;
  outcome: unknown;
}

export interface VerifyResult {
  reproducible: boolean;
  commitmentMatches: boolean;
  derivedValueMatches: boolean;
  outcomeMatches: boolean;
  reason?: string;
}

/**
 * A minimal client over the gateway and arbiter HTTP APIs — everything the
 * bot needs, nothing more. The bot never signs a transaction or holds a
 * key, so unlike `stellarcade-sdk` there's no wallet-connector surface
 * here; it only reads state and calls the arbiter's read-only `/verify`.
 */
export class ArcadeApiClient {
  constructor(
    private readonly gatewayUrl: string,
    private readonly arbiterUrl: string,
  ) {}

  async getLeaderboard(gameId?: string, limit = 10): Promise<LeaderboardEntry[]> {
    const params = new URLSearchParams();
    if (gameId) params.set("game", gameId);
    params.set("limit", String(limit));
    return getJson(this.gatewayUrl, `/leaderboard?${params.toString()}`);
  }

  async getQuests(playerAddress: string): Promise<QuestProgress[]> {
    return getJson(this.gatewayUrl, `/quests?player=${encodeURIComponent(playerAddress)}`);
  }

  async getTournaments(): Promise<TournamentSummary[]> {
    return getJson(this.gatewayUrl, "/tournaments");
  }

  async getBalance(playerAddress: string): Promise<{ address: string; balances: Record<string, string> }> {
    return getJson(this.gatewayUrl, `/wallet/${encodeURIComponent(playerAddress)}/balance`);
  }

  async verifyRound(roundId: string, stake: string): Promise<VerifyResult> {
    const proof = await getJson<FairnessProof>(this.arbiterUrl, `/proofs/${roundId}`);
    return postJson(this.arbiterUrl, "/verify", { proof, stake });
  }
}
