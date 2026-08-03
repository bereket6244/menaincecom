#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { parseTelegramJsonExport } from './json-parser.mjs';
import { sanitizedTelegramError, telegramApi } from './telegram-api.mjs';

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

const exportRoot = path.resolve(option('export') || '');
const messageId = Number(option('message-id'));
const outputDir = path.resolve(option('output') || 'reports/telegram-control-test');
const confirmed = process.argv.includes('--confirm-reversible-test');
if (!exportRoot || !messageId || !confirmed) {
  console.error('Usage: npm run telegram-control-test -- --export <folder> --message-id <id> --confirm-reversible-test');
  process.exit(1);
}

dotenv.config({ path: path.resolve('.env') });
const parsed = await parseTelegramJsonExport(exportRoot);
const message = parsed.messages.find((item) => item.id === messageId);
if (!message) throw new Error(`Message ${messageId} was not found in the export.`);
if (!message.media.some((item) => item.kind === 'photo') || !message.text) {
  throw new Error(`Message ${messageId} is not a captioned photo post.`);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHANNEL_ID || `-100${parsed.channelId}`;
const backup = {
  testedAt: new Date().toISOString(),
  channelId: chatId,
  messageId,
  originalCaption: message.text,
  originalMedia: message.media.map(({ absolutePath, ...media }) => media),
};
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, `message-${messageId}-backup.json`), `${JSON.stringify(backup, null, 2)}\n`);

let editSucceeded = false;
let restoreSucceeded = false;
let editError = null;
let restoreError = null;
const testCaption = `${message.text}\n\n[Temporary synchronization control test]`;

try {
  await telegramApi(token, 'editMessageCaption', {
    chat_id: chatId,
    message_id: messageId,
    caption: testCaption,
  });
  editSucceeded = true;
} catch (error) {
  editError = sanitizedTelegramError(error);
} finally {
  if (editSucceeded) {
    for (const delay of [0, 1_000, 3_000]) {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        await telegramApi(token, 'editMessageCaption', {
          chat_id: chatId,
          message_id: messageId,
          caption: message.text,
        });
        restoreSucceeded = true;
        restoreError = null;
        break;
      } catch (error) {
        restoreError = sanitizedTelegramError(error);
      }
    }
  }
}

const report = {
  completedAt: new Date().toISOString(),
  channelId: chatId,
  messageId,
  editSucceeded,
  restoreSucceeded,
  editError,
  restoreError,
  strategy: editSucceeded && restoreSucceeded ? 'manage_old_posts_in_place' : 'preserve_old_posts_as_archive',
};
await fs.writeFile(path.join(outputDir, `message-${messageId}-result.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (editSucceeded && !restoreSucceeded) process.exitCode = 2;
