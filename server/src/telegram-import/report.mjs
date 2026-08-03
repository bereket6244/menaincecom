import fs from 'node:fs/promises';
import path from 'node:path';

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] || 'unknown';
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join('|') : value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildReviewReport(parsed, classified, options) {
  const proposedProducts = classified
    .filter((message) => message.proposedProduct)
    .map((message) => message.proposedProduct);
  const allMedia = classified.flatMap((message) => message.media);
  const inferredAlbums = new Set(classified.map((message) => message.inferredMediaGroupId).filter(Boolean));
  const reviewRecords = classified.filter((message) =>
    message.classification === 'needs_manual_review'
    || message.classification === 'unsupported_attachment'
    || message.proposedProduct?.needsReview
  );

  return {
    generatedAt: new Date().toISOString(),
    mode: options.mode,
    source: {
      format: parsed.format,
      file: parsed.sourceFile,
      channelName: parsed.channelName,
      channelUsername: options.channelUsername,
      channelId: parsed.channelId,
      limitation: parsed.format === 'html'
        ? 'HTML exports do not expose the numeric channel ID or authoritative media-group IDs.'
        : 'This Telegram JSON export does not include authoritative media-group IDs.',
    },
    safety: {
      databaseWrites: false,
      mediaCopies: false,
      externalPublishes: false,
      sourceModified: false,
    },
    summary: {
      totalMessages: classified.length,
      totalReferencedMedia: allMedia.length,
      existingMedia: allMedia.filter((item) => item.exists).length,
      missingMedia: allMedia.filter((item) => !item.exists).length,
      detectedProducts: proposedProducts.length,
      missingTitles: proposedProducts.filter((item) => !item.name).length,
      missingPrices: proposedProducts.filter((item) => item.price == null).length,
      multiplePrices: proposedProducts.filter((item) => item.priceCandidates.length > 1).length,
      missingImages: proposedProducts.filter((item) => item.photos.length === 0).length,
      possibleReposts: classified.filter((item) => item.classification === 'product_repost').length,
      possibleUpdates: classified.filter((item) => item.classification === 'product_update').length,
      inferredAlbums: inferredAlbums.size,
      recordsRequiringReview: reviewRecords.length,
      classifications: countBy(classified, 'classification'),
    },
    proposedProducts,
    messages: classified.map((message) => ({
      telegramMessageId: message.id,
      date: message.date,
      classification: message.classification,
      classificationReasons: message.classificationReasons,
      inferredMediaGroupId: message.inferredMediaGroupId,
      replyToMessageId: message.replyToMessageId,
      text: message.text,
      hashtags: message.hashtags,
      media: message.media.map(({ absolutePath, ...item }) => item),
      proposedProduct: message.proposedProduct,
    })),
  };
}

export async function writeReviewReport(report, outputDir) {
  await fs.mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, 'telegram-import-review.json');
  const csvPath = path.join(outputDir, 'telegram-import-review.csv');
  const summaryPath = path.join(outputDir, 'telegram-import-summary.md');
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const headers = [
    'telegram_message_id', 'date', 'classification', 'title', 'pricing_mode', 'price',
    'price_candidates', 'unavailable', 'media_count', 'hashtags', 'needs_review', 'review_reasons',
  ];
  const rows = report.messages.map((message) => {
    const product = message.proposedProduct;
    return [
      message.telegramMessageId,
      message.date,
      message.classification,
      product?.name,
      product?.pricingMode,
      product?.price,
      product?.priceCandidates,
      product?.unavailable,
      message.media.length,
      message.hashtags,
      product?.needsReview,
      [...message.classificationReasons, ...(product?.reviewReasons || [])],
    ].map(csvCell).join(',');
  });
  await fs.writeFile(csvPath, `${headers.join(',')}\n${rows.join('\n')}\n`, 'utf8');

  const summary = report.summary;
  const markdown = `# Telegram Import Dry-Run\n\n`
    + `Generated: ${report.generatedAt}\n\n`
    + `- Source format: ${report.source.format}\n`
    + `- Channel: ${report.source.channelName} (@${report.source.channelUsername})\n`
    + `- Messages: ${summary.totalMessages}\n`
    + `- Referenced media: ${summary.totalReferencedMedia}\n`
    + `- Detected products: ${summary.detectedProducts}\n`
    + `- Missing titles: ${summary.missingTitles}\n`
    + `- Missing prices: ${summary.missingPrices}\n`
    + `- Multiple prices: ${summary.multiplePrices}\n`
    + `- Missing images: ${summary.missingImages}\n`
    + `- Missing media files: ${summary.missingMedia}\n`
    + `- Possible reposts: ${summary.possibleReposts}\n`
    + `- Possible updates: ${summary.possibleUpdates}\n`
    + `- Inferred albums: ${summary.inferredAlbums}\n`
    + `- Records requiring review: ${summary.recordsRequiringReview}\n\n`
    + `No database writes, media copies, or external publishing were performed.\n`;
  await fs.writeFile(summaryPath, markdown, 'utf8');
  return { jsonPath, csvPath, summaryPath };
}
