import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import type { CommandRouter } from "../core/command-router.js";
import { logger } from "../logger.js";

/**
 * Wires Telegraf's text-message events into the shared {@link CommandRouter}.
 * Telegraf has its own `bot.command()` sugar, but routing every text
 * message through our own parser keeps command handling identical between
 * Telegram and Discord — one router, one set of tests, two thin adapters.
 */
export function createTelegramBot(token: string, router: CommandRouter): Telegraf {
  const bot = new Telegraf(token);

  bot.on(message("text"), async (ctx) => {
    const text = ctx.message.text;
    await router.route(text, {
      platform: "telegram",
      userId: String(ctx.from.id),
      displayName: ctx.from.username ?? ctx.from.first_name,
      reply: async (reply) => {
        await ctx.reply(reply);
      },
    });
  });

  bot.catch((err, ctx) => {
    logger.error({ err, updateType: ctx.updateType }, "telegram bot error");
  });

  return bot;
}
