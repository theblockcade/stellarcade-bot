export type Platform = "telegram" | "discord";

/**
 * A platform-neutral view of "someone sent a command". Both adapters
 * (telegram.ts, discord.ts) translate their own SDK's message shape into
 * this before handing off to the shared command router — command handlers
 * never touch a platform SDK type directly.
 */
export interface CommandContext {
  platform: Platform;
  /** Platform-specific user id (Telegram numeric id, Discord snowflake) — NOT a Stellar address. */
  userId: string;
  displayName: string;
  args: string[];
  reply(text: string): Promise<void>;
}

export interface CommandHandler {
  name: string;
  description: string;
  handle(ctx: CommandContext): Promise<void>;
}
