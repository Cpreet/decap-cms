#!/usr/bin/env bun
// Convert speaker-labeled transcript text to WebVTT.
//
// Input format (one cue per blank-line-separated block, or one per non-empty line):
//   Speaker 1 [0:00 - 0:08]: I just want to know like for the community...
//   Speaker 2 [0:06 - 0:07]: Mm-hmm.
//
// Usage:
//   bun scripts/text-to-vtt.ts <input.txt> [output.vtt]
//   bun scripts/text-to-vtt.ts content/transcripts/foo.txt
//   (omit output to write alongside input with .vtt extension)

import fs from 'node:fs';
import path from 'node:path';

const CUE_RE = /^\s*(.+?)\s*\[\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*\]\s*:\s*([\s\S]*)$/;

function toVttStamp(t: string): string {
  // Accept m:ss or h:mm:ss → emit hh:mm:ss.000
  const parts = t.split(':').map(Number);
  let h = 0, m = 0, s = 0;
  if (parts.length === 3) [h, m, s] = parts;
  else if (parts.length === 2) [m, s] = parts;
  else s = parts[0];
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.000`;
}

function convert(text: string): string {
  const out: string[] = ['WEBVTT', ''];
  // Normalize line endings; treat each non-empty line that matches the cue pattern as a cue.
  const lines = text.replace(/\r/g, '').split('\n');
  let buffer = '';
  const flush = () => {
    if (!buffer) return;
    const m = buffer.match(CUE_RE);
    if (m) {
      const [, speaker, startRaw, endRaw, body] = m;
      out.push(`${toVttStamp(startRaw)} --> ${toVttStamp(endRaw)}`);
      out.push(`${speaker.trim()}: ${body.trim()}`);
      out.push('');
    } else {
      console.warn(`Skipped (no match): ${buffer.slice(0, 80)}`);
    }
    buffer = '';
  };
  for (const ln of lines) {
    if (!ln.trim()) { flush(); continue; }
    if (CUE_RE.test(ln)) { flush(); buffer = ln; }
    else if (buffer) { buffer += ' ' + ln.trim(); }
    else { /* skip stray lines */ }
  }
  flush();
  return out.join('\n');
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: bun scripts/text-to-vtt.ts <input.txt> [output.vtt]');
  process.exit(1);
}
const inputPath = args[0];
const outputPath = args[1] || inputPath.replace(/\.[^.]+$/, '') + '.vtt';
const src = fs.readFileSync(inputPath, 'utf8');
const vtt = convert(src);
fs.writeFileSync(outputPath, vtt);
console.log(`✅ Wrote ${path.relative(process.cwd(), outputPath)}`);
