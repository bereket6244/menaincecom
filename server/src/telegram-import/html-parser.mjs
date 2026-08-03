import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';

const MEDIA_SELECTOR = '.photo_wrap[href], .video_file_wrap[href]';

function cleanText(element) {
  if (!element?.length) return '';
  const clone = element.clone();
  clone.find('br').replaceWith('\n');
  return clone
    .text()
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseTelegramDate(value) {
  const match = String(value || '').match(
    /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2}) UTC([+-]\d{2}):(\d{2})$/
  );
  if (!match) return null;
  const [, day, month, year, hour, minute, second, offsetHour, offsetMinute] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offsetHour}:${offsetMinute}`;
}

function resolveMediaPath(exportRoot, relativePath) {
  const normalized = String(relativePath || '').replaceAll('\\', '/').replace(/^\/+/, '');
  const absolutePath = path.resolve(exportRoot, normalized);
  const rootPrefix = `${path.resolve(exportRoot)}${path.sep}`;
  if (!absolutePath.startsWith(rootPrefix)) {
    return { relativePath: normalized, absolutePath: null, pathError: 'path_traversal' };
  }
  return { relativePath: normalized, absolutePath, pathError: null };
}

async function inspectMedia(exportRoot, relativePath) {
  const resolved = resolveMediaPath(exportRoot, relativePath);
  if (!resolved.absolutePath) return { ...resolved, exists: false, size: null, sha256: null };
  try {
    const [buffer, stat] = await Promise.all([
      fs.readFile(resolved.absolutePath),
      fs.stat(resolved.absolutePath),
    ]);
    return {
      ...resolved,
      exists: stat.isFile(),
      size: stat.size,
      sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { ...resolved, exists: false, size: null, sha256: null };
  }
}

export function inferAlbumGroups(messages) {
  let index = 0;
  while (index < messages.length) {
    const first = messages[index];
    const group = [first];
    let cursor = index + 1;
    while (cursor < messages.length && messages[cursor].dateRaw === first.dateRaw) {
      group.push(messages[cursor]);
      cursor += 1;
    }
    const textCount = group.filter((message) => message.text).length;
    const allHaveMedia = group.every((message) => message.media.length > 0);
    if (group.length >= 2 && group.length <= 10 && allHaveMedia && textCount <= 1) {
      const groupId = `html-inferred-${group[0].id}-${group.at(-1).id}`;
      const representative = group.find((message) => message.text) || group[0];
      for (const message of group) {
        message.inferredMediaGroupId = groupId;
        message.albumRepresentativeId = representative.id;
      }
      representative.albumMedia = group.flatMap((message) => message.media);
    }
    index = cursor;
  }
}

export async function parseTelegramHtmlExport(exportRoot) {
  const htmlPath = path.join(exportRoot, 'messages.html');
  const html = await fs.readFile(htmlPath, 'utf8');
  const $ = load(html, { decodeEntities: true });
  const channelName = cleanText($('.page_header .text.bold').first());
  const messages = [];

  for (const element of $('.message.default').toArray()) {
    const message = $(element);
    const idMatch = String(message.attr('id') || '').match(/^message(\d+)$/);
    if (!idMatch) continue;
    const dateRaw = message.find('.date.details[title]').first().attr('title') || '';
    const media = [];
    for (const mediaElement of message.find(MEDIA_SELECTOR).toArray()) {
      const link = $(mediaElement);
      const href = link.attr('href') || '';
      const inspected = await inspectMedia(exportRoot, href);
      media.push({
        ...inspected,
        kind: link.hasClass('video_file_wrap') ? 'video' : 'photo',
      });
    }
    const replyOnclick = message.find('.reply_to a').first().attr('onclick') || '';
    const replyMatch = replyOnclick.match(/GoToMessage\((\d+)\)/);
    messages.push({
      id: Number(idMatch[1]),
      dateRaw,
      date: parseTelegramDate(dateRaw),
      text: cleanText(message.find('.body > .text').first()),
      hashtags: message.find('.body > .text a').toArray()
        .map((anchor) => cleanText($(anchor)).replace(/^#/, '').toLowerCase())
        .filter(Boolean),
      media,
      replyToMessageId: replyMatch ? Number(replyMatch[1]) : null,
      forwarded: message.find('.forwarded').length > 0,
      joined: message.hasClass('joined'),
      inferredMediaGroupId: null,
      albumRepresentativeId: null,
      albumMedia: null,
    });
  }

  inferAlbumGroups(messages);
  return {
    format: 'html',
    sourceFile: htmlPath,
    channelName,
    channelId: null,
    messages,
  };
}
