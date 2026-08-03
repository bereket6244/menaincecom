#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import fs from 'node:fs/promises';
import { parseTelegramHtmlExport } from './html-parser.mjs';
import { parseTelegramJsonExport } from './json-parser.mjs';
import { classifyMessages } from './classifier.mjs';
import { buildReviewReport, writeReviewReport } from './report.mjs';

function parseArgs(argv) {
  const [command = 'help', ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (!value.startsWith('--')) continue;
    options[value.slice(2)] = rest[index + 1];
    index += 1;
  }
  return { command, options };
}

function usage() {
  console.log(`Usage:
  npm run telegram-import -- inspect --export <folder> [--output <folder>] [--channel-username <name>]
  npm run telegram-import -- report --export <folder> [--output <folder>] [--channel-username <name>]
  npm run telegram-import -- dry-run --export <folder> [--output <folder>] [--channel-username <name>]

These commands are read-only: they do not write to MySQL, copy media, or publish externally.`);
}

const { command, options } = parseArgs(process.argv.slice(2));
if (!['inspect', 'report', 'dry-run'].includes(command) || !options.export) {
  usage();
  process.exit(command === 'help' ? 0 : 1);
}

const exportRoot = path.resolve(options.export);
const outputDir = path.resolve(options.output || 'reports/telegram-import');
const channelUsername = String(options['channel-username'] || 'menaweddingcatalogue').replace(/^@/, '');
const hasJson = await fs.access(path.join(exportRoot, 'result.json')).then(() => true, () => false);
const parsed = hasJson
  ? await parseTelegramJsonExport(exportRoot)
  : await parseTelegramHtmlExport(exportRoot);
const classified = classifyMessages(parsed.messages, channelUsername);
const report = buildReviewReport(parsed, classified, { mode: command, channelUsername });
const files = await writeReviewReport(report, outputDir);

console.log(JSON.stringify({ summary: report.summary, files }, null, 2));
