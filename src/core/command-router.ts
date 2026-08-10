import { RateLimiter } from "./rate-limiter.js";
import type { CommandContext, CommandHandler } from "./types.js";

export interface CommandRouterOptions {
  /** Requests allowed per user before rate limiting kicks in. Default 5. */
  rateLimitCapacity?: number;
  /** Tokens refilled per second. Default 1 (i.e. one command every ~1s sustained). */
  rateLimitRefillPerSecond?: number;
}

/**
 * Platform-agnostic command dispatch. Both adapters parse their own SDK's
 * message event into a command name + {@link CommandContext} and hand off
 * to `route()` — everything past that point (rate limiting, handler lookup,
 * error formatting) is shared, so a bug fix here fixes both platforms at
 * once.
 */
export class CommandRouter {
  private handlers = new Map<string, CommandHandler>();
  private limiter: RateLimiter;

  constructor(options: CommandRouterOptions = {}) {
    this.limiter = new RateLimiter(
      options.rateLimitCapacity ?? 5,
      options.rateLimitRefillPerSecond ?? 1,
    );
  }

  register(handler: CommandHandler): void {
    if (this.handlers.has(handler.name)) {
      throw new Error(`Command "${handler.name}" is already registered`);
    }
    this.handlers.set(handler.name, handler);
  }

  list(): CommandHandler[] {
    return [...this.handlers.values()];
  }

  /** Parses `/play coin-flip heads` into `{ name: "play", args: ["coin-flip", "heads"] }`. */
  static parse(text: string): { name: string; args: string[] } | null {
    const trimmed = text.trim();
    if (!trimmed.startsWith("/")) return null;
    const [head, ...rest] = trimmed.slice(1).split(/\s+/);
    if (!head) return null;
    // Telegram commands can carry a @botname suffix, e.g. "/play@StellarCadeBot".
    const name = head.split("@")[0]!.toLowerCase();
    return { name, args: rest };
  }

  async route(commandText: string, ctx: Omit<CommandContext, "args">): Promise<void> {
    const parsed = CommandRouter.parse(commandText);
    if (!parsed) {
      return;
    }

    const rateLimitKey = `${ctx.platform}:${ctx.userId}`;
    if (!this.limiter.tryConsume(rateLimitKey)) {
      await ctx.reply("You're sending commands too fast — please wait a moment and try again.");
      return;
    }

    const handler = this.handlers.get(parsed.name);
    if (!handler) {
      await ctx.reply(`Unknown command "/${parsed.name}". Try /help to see what's available.`);
      return;
    }

    try {
      await handler.handle({ ...ctx, args: parsed.args });
    } catch (err) {
      await ctx.reply(`Something went wrong running /${parsed.name}: ${(err as Error).message}`);
    }
  }
}
