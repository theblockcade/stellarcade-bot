import { Client, GatewayIntentBits, Partials } from "discord.js";
import type { CommandRouter } from "../core/command-router.js";
import { logger } from "../logger.js";

/**
 * Discord has no native "/" text-command convention (that's reserved for
 * slash commands, a separate registration flow) — so this adapter accepts
 * either `!command` or `/command` as a prefix and normalizes to `/` before
 * handing off to the same {@link CommandRouter} Telegram uses.
 *
 * Requires the privileged "Message Content Intent" enabled in the Discord
 * Developer Portal for the bot application — without it, `message.content`
 * arrives empty for non-mention messages.
 *
 * Mirrors the Telegram adapter's shape: builds and wires the client but
 * does not log in — the caller (bot.ts) owns the connect/shutdown
 * lifecycle for both platforms symmetrically.
 */
export function createDiscordBot(router: CommandRouter): Client {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages],
    partials: [Partials.Channel],
  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    const content = message.content.trim();
    if (!content.startsWith("!") && !content.startsWith("/")) return;

    const normalized = content.startsWith("!") ? `/${content.slice(1)}` : content;

    await router.route(normalized, {
      platform: "discord",
      userId: message.author.id,
      displayName: message.author.username,
      reply: async (reply) => {
        await message.reply(reply);
      },
    });
  });

  client.on("error", (err) => {
    logger.error({ err }, "discord bot error");
  });

  client.once("ready", (c) => {
    logger.info({ tag: c.user.tag }, "discord bot ready");
  });

  return client;
}
