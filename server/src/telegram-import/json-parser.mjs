import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { inferAlbumGroups } from './html-parser.mjs';

function flattenText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(flattenText).join('');
  if (value && typeof value === 'object') return flattenText(value.text || '');
  return '';
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

async function inspectMedia(exportRoot, relativePath, kind) {
  const resolved = resolveMediaPath(exportRoot, relativePath);
  if (!resolved.absolutePath) {
    return { ...resolved, kind, exists: false, size: null, sha256: null };
  }
  try {
    const [buffer, stat] = await Promise.all([
      fs.readFile(resolved.absolutePath),
      fs.stat(resolved.absolutePath),
    ]);
    return {
      ...resolved,
      kind,
      exists: stat.isFile(),
      size: stat.size,
      sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { ...resolved, kind, exists: false, size: null, sha256: null };
  }
}

function messageDate(message) {
  const unixSeconds = Number(message.date_unixtime);
  if (Number.isFinite(unixSeconds) && unixSeconds > 0) {
    return new Date(unixSeconds * 1000).toISOString();
  }
  return message.date || null;
}

export async function parseTelegramJsonExport(exportRoot) {
  const jsonPath = path.join(exportRoot, 'result.json');
  const raw = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
  const messages = [];

  for (const source of raw.messages || []) {
    if (source.type !== 'message') continue;
    const media = [];
    if (source.photo) media.push(await inspectMedia(exportRoot, source.photo, 'photo'));
    if (source.file) {
      const video = source.media_type === 'video_file' || /\.(?:mov|mp4|webm)$/i.test(source.file);
      media.push(await inspectMedia(exportRoot, source.file, video ? 'video' : 'document'));
    }
    const text = flattenText(source.text).trim();
    const entities = source.text_entities || [];
    messages.push({
      id: Number(source.id),
      dateRaw: source.date || '',
      date: messageDate(source),
      text,
      hashtags: entities
        .filter((entity) => entity.type === 'hashtag')
        .map((entity) => flattenText(entity.text).replace(/^#/, '').toLowerCase())
        .filter(Boolean),
      media,
      replyToMessageId: source.reply_to_message_id ? Number(source.reply_to_message_id) : null,
      forwarded: Boolean(source.forwarded_from || source.forwarded_from_id),
      joined: false,
      inferredMediaGroupId: source.media_group_id ? String(source.media_group_id) : null,
      albumRepresentativeId: null,
      albumMedia: null,
    });
  }

  if (!messages.some((message) => message.inferredMediaGroupId)) inferAlbumGroups(messages);
  return {
    format: 'json',
    sourceFile: jsonPath,
    channelName: raw.name || '',
    channelId: raw.id ? Number(raw.id) : null,
    channelType: raw.type || null,
    messages,
  };
}
