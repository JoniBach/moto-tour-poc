---
name: release
description: Publish the GT Retrospective blog to production - commit new stories, build, deploy, and draft (or send) the mailing-list email for each new story. Use when the user asks to publish, release or deploy stories/content to prod.
---

# Release the blog

The user invoking this is their go-ahead for a **production deploy** of moto-tour-poc.

1. In `H:\workspaces\play\moto-tour-poc`, run `npm run release` (add `-- --send` only if the user said
   to send the emails, `-- --no-email` if they said not to email). It takes several minutes: run it
   in the foreground with a 10-minute timeout, output to a log file, and read the tail.
2. Before running, glance at `git status --short -- tours/` and tell the user which story files will
   be committed. Stories with `when`/`time` problems are skipped by build-blog with a message: report
   those.
3. Report: what was committed, that the deploy succeeded (privacy audit result), the live feed's
   story count, and which emails were drafted or sent (from the script output). If emails were
   skipped for a missing `BUTTONDOWN_API_KEY`, say how to add it (Buttondown → Settings → API, into
   `.env.local`).
4. If it fails: the deploy retries uploads itself; a privacy-audit failure means a story or photo
   leaks a privacy zone. Fix the cause, don't bypass the audit.

Don't push to GitHub unless asked.
