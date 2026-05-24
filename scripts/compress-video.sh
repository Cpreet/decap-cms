#!/usr/bin/env bash
#
# Compress a video so it fits under the Decap CMS / Netlify git-gateway upload
# limit. git-gateway proxies uploads through a serverless function capped at
# ~6 MB request body, and Decap base64-encodes files (+~33%), so the raw file
# must stay under ~4 MB. Default target is 4 MB.
#
# Usage:
#   scripts/compress-video.sh input.mp4 [targetMB] [output.mp4]
#
# Examples:
#   scripts/compress-video.sh raw-interview.mov          # -> raw-interview-web.mp4, ~4MB
#   scripts/compress-video.sh clip.mp4 3                  # target 3 MB
#   scripts/compress-video.sh clip.mp4 4 ready-to-up.mp4 # custom output name
#
set -euo pipefail

in="${1:?usage: compress-video.sh input [targetMB] [output]}"
target_mb="${2:-4}"
out="${3:-${in%.*}-web.mp4}"

command -v ffmpeg  >/dev/null || { echo "ffmpeg not found"; exit 1; }
command -v ffprobe >/dev/null || { echo "ffprobe not found"; exit 1; }

dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")
[ -z "$dur" ] && { echo "could not read duration of $in"; exit 1; }

audio_k=96
# total kbit/s = targetMB * 1024 * 8 / duration, with 4% container headroom
total_k=$(awk -v mb="$target_mb" -v d="$dur" 'BEGIN{printf "%d", mb*8192/d*0.96}')
video_k=$(( total_k - audio_k ))
[ "$video_k" -lt 200 ] && video_k=200

passlog="$(mktemp -u)"
echo "→ ${in}  (${dur%.*}s)  target ${target_mb}MB  →  video ${video_k}k / audio ${audio_k}k"

ffmpeg -y -hide_banner -loglevel error -i "$in" \
  -c:v libx264 -b:v "${video_k}k" -vf "scale='min(1280,iw)':-2" \
  -passlogfile "$passlog" -pass 1 -an -f mp4 /dev/null
ffmpeg -y -hide_banner -loglevel error -i "$in" \
  -c:v libx264 -b:v "${video_k}k" -vf "scale='min(1280,iw)':-2" \
  -passlogfile "$passlog" -pass 2 -c:a aac -b:a "${audio_k}k" \
  -movflags +faststart "$out"
rm -f "${passlog}"*.log "${passlog}"*.log.mbtree 2>/dev/null || true

size_mb=$(awk -v b="$(stat -c%s "$out" 2>/dev/null || stat -f%z "$out")" 'BEGIN{printf "%.2f", b/1048576}')
echo "✓ wrote ${out}  (${size_mb} MB)"
awk -v s="$size_mb" -v t="$target_mb" 'BEGIN{ if (s+0 > t+0) print "⚠  still over target — try a lower targetMB or shorter clip" }'
