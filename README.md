# Open Brain — Student Edition

A personal AI knowledge base you actually own. Write thoughts, ideas, and notes. They save to your own database. Nobody else has access.

**This repo is a starting point — not a finished product. Fork it and make it yours.**

---

## What you need before starting
- A GitHub account
- A Supabase account (free at supabase.com)
- About 30–45 minutes

## The short version
1. Fork this repo to your own GitHub
2. Create a Supabase project, run `migration.sql` in the SQL editor
3. Copy your Supabase URL and anon key into `config.js`
4. Enable GitHub Pages on your fork
5. Open your live URL and save your first thought

## The coached version
Use this prompt with Claude AI — it will walk you through every step:

> *Paste the contents of `STUDENT-PROMPT.md` into claude.ai*

---

## Files
| File | What it is |
|---|---|
| `index.html` | The whole app — one file |
| `config.js` | The only file you edit — your two Supabase values go here |
| `migration.sql` | Run this once in Supabase to create your database table |
| `STUDENT-PROMPT.md` | The Claude coaching prompt |

---

## A note on your anon key
Your Supabase anon key lives in `config.js` which is public on GitHub. **That is fine and intentional.** Supabase designed the anon key to be safe in public code — it has limited permissions and your data is protected by Row Level Security. It is not a secret. Your service role key (a different key you will see in Supabase settings) IS a secret — never put that one in code.
