# ClassVault

**See something. Save it. Find it later, and know what to do first.**

ClassVault is a local-first iOS app (Capacitor) where students save assignments, notes, links, photos and files by class. For ImpactHack it gained **Smart Import** (AI turns messy assignment text into tasks) and a **Workload Engine** that answers what deadlines alone can't: *what should I work on first?*

## Hackathon transparency
ClassVault 1.0 existed before ImpactHack (Was created a few days prior to start) (see tag `v1.0-pre-hackathon`). Everything below is new work since then:
- Estimated time on assignments, and a "how long did it actually take?" prompt on completion
- An on-device estimator that learns how long *this student* takes per class
- A capacity-based scheduler that ranks tasks and says when each must start, and why
- **Smart Import**: Llama 3.1 on Cloudflare Workers AI extracts reviewable tasks from pasted text (server-side rate limits, validated structured output, no API key)
- A labelled demo-data mode and automated tests (`npm test`)

## The problem
Students don't just have too many assignments. They don't know what to do first. Sorting by due date ignores how long each task takes and how much else is due around it.

## The product story
Messy assignment text, then **Smart Import** extracts tasks, the student reviews and edits, ClassVault saves them, the **Workload Engine** predicts workload and decides what to do first, the student finishes tasks, and future estimates improve.

## How the Workload Engine works
1. **Predict the time.** Each assignment has an estimate. For every class we compute the ratio `actual / estimate` from finished work (clamped to 0.4x to 3x), averaged with an overall ratio using a prior weight of 2 (shrinkage). Few data points means predictions stay close to the student's estimate, and they adapt as history grows. No estimate assumes 45 minutes.
2. **Schedule backward.** Given the hours the student can work per day, tasks are placed starting from the latest due date, filling days backward. The day a task's work must begin is its *start by* day. Work that cannot fit is flagged with how many minutes it is short.
3. **Rank and explain.** Tasks are ordered by overload, then start-by day, then due date. Each reason is generated from the numbers (nothing is invented).

This is statistics plus scheduling logic, not machine learning, and we did not train a model.

## Smart Import: AI, models and APIs
- **Model:** Meta **Llama 3.1 8B Instruct** (`@cf/meta/llama-3.1-8b-instruct-fast`) running on **Cloudflare Workers AI**, which is on Cloudflare's JSON-mode model list. **Built with Llama.** The Llama 3.1 Community License and Acceptable Use Policy apply: <https://github.com/meta-llama/llama-models/blob/main/models/llama3_1/LICENSE>.
- **No API key is required.** The Worker reaches the model through a Cloudflare binding (`[ai]` in `worker/wrangler.toml`), so there is nothing to create, paste or leak.
- **Free tier:** Workers AI includes 10,000 Neurons per day on the free plan. A request costs roughly 50 Neurons on this model (an estimate from Cloudflare's published per-token rates), so the Worker has a **global safety cap of 100 AI requests per day**. When Cloudflare's free allocation runs out, the app shows "daily AI budget used".
- Built with AI coding assistance (Claude), which the hackathon permits.

### Architecture
```
Student -> ClassVault Smart Import -> Cloudflare Worker
                                        |- input validation
                                        |- rate limits (before any AI call)
                                        '- Workers AI (Llama 3.1, JSON mode)
                                              -> output validation -> Review screen
                                              -> ClassVault -> Adaptive Workload Engine
```
- **Dates are resolved by code, not by the model.** The model only quotes the deadline words ("Friday"); the Worker turns them into a date, and drops any date or class that the pasted text does not support. Small models are weak at calendar arithmetic and tend to invent details, so this keeps blanks blank.
- Output is requested as JSON, then **re-validated on the server and again in the app**. Bad types, absurd durations and unusable answers are corrected or rejected. Free text from the model never drives the app.
- The pasted text is treated as data (prompt-injection resistant), and the Worker does not store or log it.
- Nothing is auto-saved: the student reviews and edits first.
- If Smart Import is unavailable, everything else works.

### Rate limits (server-side, before the AI is called; configurable in `worker/wrangler.toml`)
| Limit | Default |
|---|---|
| Requests per minute per device | 3 |
| Requests per day per device | 10 |
| Requests per minute / day per IP | 9 / 30 |
| Global AI requests per day (budget cap) | 100 |
| Input size / output tokens | 4000 chars / 1500 |

There are no accounts, so the "device" is a random id the app generates. It is only a rate-limit bucket, never an identity, and the per-IP and global limits stop it being bypassed by changing the id. Exceeding a limit returns HTTP 429.

### Deploy the Worker
```
cd worker
npm install --save-dev wrangler
npx wrangler login
npx wrangler kv namespace create RATE_KV   # paste the id into wrangler.toml (uncomment the block)
npx wrangler deploy                        # prints https://classvault-smart-import.<you>.workers.dev
```
Put that address plus `/api/smart-import` into `SMART_IMPORT_URL` in `www/index.html`. For local work run `npx wrangler dev` inside `worker/`.

### Live test against the real model
```
WORKER_URL=https://<your-worker>/api/smart-import node worker/scripts/live-test.mjs
```
It runs three inputs (a normal one, a chemistry one, and a deliberately messy one that must come back with blank dates and class), prints every extracted field, and flags invented dates or classes. Read the output yourself too.

### Try Smart Import
Home or the + menu, then **Smart Import**, accept the notice, paste for example: *Read chapters 4-5 for Monday, answer questions 1-10, and write a 500-word response. Study the vocabulary because there's a quiz Tuesday.* Review, edit, **Add to ClassVault**, and you land on the ranked workload plan.

## Privacy
The vault is stored on the device (localStorage + IndexedDB): no accounts, analytics or ads, and no sync. **Exception: Smart Import.** When a student chooses it and accepts an on-screen notice, the pasted text is sent to the Worker and processed by Cloudflare Workers AI. We do not store it, and Cloudflare's documentation says it does not use Workers AI content to train models or improve services. Students are told not to paste private information. No other feature makes network requests.

## Accuracy and limitations (honest version)
- Not validated on a real student population. The demo history is synthetic and written to show the effect.
- The Workload Engine only learns from estimates and times students enter, and cannot see task difficulty.
- Start-by dates are "latest possible" start days, so they have no safety buffer yet.
- An 8B model is weaker than the largest models. Smart Import can miss or merge tasks on messy input, which is why students review before saving; the automated tests mock the model, so extraction quality has only been checked by hand.
- Local-only vault data means no sync between devices.
- Rate limits use KV counters, which are not atomic, so they are approximate under bursts.
- Smart Import is a hackathon feature. Before it ships to students in the App Store, the privacy policy and App Privacy answers need updating and the data flow needs review.

## Run it
- Web: open `www/index.html` in a browser.
- Tests: `npm install` then `npm test`.
- iOS: `npx cap sync ios` then `npx cap open ios` (needs Xcode).
- Try the engine: Home, then **Analyze my workload**, then **Load demo data (for judges)**.
