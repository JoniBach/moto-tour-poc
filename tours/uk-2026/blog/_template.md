---
title: Your title here
time: 2026-09-16 11:30
cover: 20260916_113010
---

Files starting with "_" are drafts and aren't published. Copy this file, rename it (the file
name becomes the post's address), and set `time` to the moment it's about (the tour's local time): the
post appears on the map wherever the tour was at that moment.

`cover` is optional: a photo id (the photo's file name without the extension).

Write in **Markdown**. Embed tour photos by id:

![A caption for the photo](photo:20260916_115051)

Then run `node scripts/build-blog.mjs`, or use "✎ Post here" in the app (dev only) to copy a
ready-made header for the moment you're looking at. Or write it in the story editor at /wysiwyg,
which shows it exactly as it will read and saves the file.
