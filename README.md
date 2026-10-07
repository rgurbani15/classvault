# ClassVault

**See something. Save it. Find it later, and know what to do first.**

ClassVault is a local-first student app for iPhone. Students save assignments, notes, links, photos and files by class, then ask ClassVault what to work on first.

**Live demo:** <https://classvault-demo.pages.dev> I recommend using private browsing so the whole website resets. (runs in any browser; Smart Import shares a small free AI budget, so it may show "daily AI budget used" if many people try it), the site has rate limiting. 

Terms of Service, Privacy Policy- https://sites.google.com/view/classvaultorganizer/home

## Status: from hackathon project to a real App Store app
**ClassVault 1.0 is submitted to Apple and in App Review. Once version 1.0 has been reviewed and published, ClassVault will be available as an actual app on the App Store.** The two ImpactHack features below (the Workload Engine and Smart Import) are built on top of 1.0 and are planned to follow in an update. Smart Import sends pasted text to an AI service, so before it reaches students in the App Store the privacy policy and the App Store privacy answers must be updated and reviewed. Until then this repository is a working demo.

## The problem
Students don't just have too many assignments. They don't know what to do first. Their school information is scattered across Google Classroom, Canvas, email, screenshots and notes, and sorting by due date ignores how long each task takes and how much else is due around it.

## What ClassVault does
- **Quick Save** an assignment, note, link, photo or file in a few taps, organized by class.
- **Vault, Classes and Search** to find anything later, with filters for class, type, status and due date.
- **Smart Import (AI):** paste messy assignment text and get reviewable tasks.
- **Workload plan:** a ranked "what to do first" list with start-by days and a reason for each task.
- **Learns from you:** after you finish a task and say how long it took, future estimates for that class improve.
- **Local-first:** your vault stays on your device, with no account and no ads.

## The demo story
Messy assignment text, then **Smart Import** extracts tasks, the student reviews and edits, ClassVault saves them, the **Workload Engine** predicts the workload and decides what to do first, the student finishes tasks, and future estimates improve.

## What's new for ImpactHack (transparency)
ClassVault 1.0 existed before ImpactHack (it was created a few days before the hackathon started; see the tag `v1.0-pre-hackathon`). New work since then:
- Estimated time on assignments, and a "how long did it take?" prompt on completion
- The adaptive Workload Engine (estimator plus scheduler) and its plan screen
- **Smart Import**, backed by a rate-limited Cloudflare Worker using Workers AI
- Visible entry points for Smart Import and Analyze from first launch, and a Search tab that is useful when empty
- A labelled demo-data mode, and 33 automated tests

## How the Workload Engine works
This is statistics plus scheduling logic. It is not machine learning, and no model was trained.
1. **Predict the time.** For each class we average `actual / estimate` from finished tasks (clamped to 0.4x to 3x) and blend it with the student's overall ratio using a prior weight of 2. With little history the prediction stays near the student's own estimate, and it adapts as history grows. With no estimate it assumes 45 minutes.
2. **Schedule backward.** Given the hours the student can work each day, work is placed starting from the latest due date and filling days backward. The day a task's work must begin is its *start by* day. Work that cannot fit is flagged with how many minutes it is short.
3. **Rank and explain.** Tasks are ordered by overload, then start-by day, then due date. Each reason is generated from the numbers, so nothing is invented.

## Smart Import (generative AI)
- **Model:** Meta **Llama 3.1 8B Instruct** (`@cf/meta/llama-3.1-8b-instruct-fast`) on **Cloudflare Workers AI**. **Built with Llama.** The Llama 3.1 Community License and Acceptable Use Policy apply: <https://github.com/meta-llama/llama-models/blob/main/models/llama3_1/LICENSE>. The plain `llama-3.1-8b-instruct` was deprecated by Cloudflare on 2026-05-30, so the `-fast` variant is used.
- **No API key.** The Worker reaches the model through a Cloudflare binding, so there is no key to create, store or leak.
- **Free tier:** Workers AI includes 10,000 Neurons a day on the free plan. The Worker has a global safety cap of 100 AI requests a day, and the app shows "daily AI budget used" when Cloudflare's allowance runs out.

```
Student -> ClassVault Smart Import -> Cloudflare Worker
                                        |- input validation
                                        |- rate limits (before any AI call)
                                        '- Workers AI (Llama 3.1, JSON mode)
                                              -> output validation -> Review screen
                                              -> ClassVault -> Workload Engine
```
- **Dates are resolved by code, not the model.** The model only quotes the deadline words ("Friday"), and the Worker turns them into a date. Any date or class that the pasted text does not support is dropped, so unknown fields stay blank.
- **Validated three times:** JSON mode on the request, strict checks on the server, and checks again in the app. Free text from the model never drives the app. If JSON mode fails, the Worker retries once without it and validates the same way.
- **Nothing is auto-saved.** The student reviews and edits first, and the pasted text is treated as data, not instructions.
- **If Smart Import is unavailable,** the rest of ClassVault works normally.

### Rate limits (server-side, before the AI is called; set in `worker/wrangler.toml`)
| Limit | Default |
|---|---|
| Requests per minute / day per device | 3 / 10 |
| Requests per minute / day per IP | 9 / 30 |
| Global AI requests per day | 100 |
| Input size / output tokens | 4000 chars / 1500 |

There are no accounts, so a "device" is a random id the app generates. It is only a rate-limit bucket, and the IP and global limits stop it being bypassed. Exceeding a limit returns HTTP 429.

## Tech stack
HTML, CSS and JavaScript wrapped as an iOS app with **Capacitor** (Xcode project in `ios/`), localStorage and IndexedDB for data, a **Cloudflare Worker** with **Workers AI** and **Workers KV** for Smart Import, and Node's built-in test runner with jsdom for tests.

## Run it
- **Web:** open `www/index.html` in a browser.
- **Tests:** `npm install`, then `npm test`.
- **iOS:** `npx cap sync ios`, then `npx cap open ios` (needs Xcode).
- **Deploy the Worker:**
  ```
  cd worker
  npm install --save-dev wrangler
  npx wrangler login
  npx wrangler kv namespace create RATE_KV   # paste the id into wrangler.toml
  npx wrangler deploy
  ```
  Put the printed address, plus `/api/smart-import`, into `SMART_IMPORT_URL` in `www/index.html`.
- **Live test against the real model:** `WORKER_URL=https://<your-worker>/api/smart-import node worker/scripts/live-test.mjs`
- **Try it:** on Home tap **Smart Import**, accept the notice, and paste: *Read chapters 4-5 for Monday, answer questions 1-10, and write a 500-word response. Study the vocabulary because there's a quiz Tuesday.* Review, save, and the workload plan opens. Use **Load demo data (for judges)** on the plan screen to see the learning effect.

## Privacy
The vault is stored on the device (localStorage and IndexedDB), with no accounts, analytics or ads, and no sync. **The one exception is Smart Import:** when a student chooses it and accepts the on-screen notice, the pasted text is sent to the Worker and processed by Cloudflare Workers AI. We do not store it, and Cloudflare's documentation says it does not use Workers AI content to train models. Students are told not to paste private information.

## Accuracy and limitations
- The Workload Engine has not been validated on a real student population. The demo history is synthetic and written to show the effect.
- It only learns from estimates and times that students enter, and it cannot see task difficulty.
- Start-by dates are "latest possible" days, with no safety buffer yet.
- An 8B model is weaker than the largest models. Smart Import can miss or merge tasks on messy input, which is why students review before saving. The automated tests mock the model, so extraction quality has only been checked by hand against the live Worker.
- Vault data is local, so it does not sync between devices.
- Rate limits use Workers KV counters, which are not atomic, so they are approximate under bursts.

## Credits
Built by a high-school student for ImpactHack, with AI coding assistance (Claude), which the rules permit. Smart Import is powered by Meta Llama 3.1 on Cloudflare Workers AI.
