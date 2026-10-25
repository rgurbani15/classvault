# ClassVault

**See something. Save it. Find it later, and know what to do first.**

ClassVault is a local-first student app for iPhone and the web. Students save assignments, notes, links, photos and files by class. They can paste messy assignment text into an AI-powered **Smart Import**, and ClassVault turns it into a ranked plan of what to work on first.

| | |
|---|---|
| **Live demo** | <https://classvault-demo.pages.dev> |
| **Demo video** | <https://youtu.be/P_j7PnUjSb4> |
| **Privacy policy and terms** | <https://sites.google.com/view/classvaultorganizer/home> |
| **Source code** | <https://github.com/rgurbani15/classvault> |

Built by a high-school student for the **Congressional App Challenge 2026**. ClassVault 2.0 also placed **6th overall out of 448 participants and projects, and won the Best Education Project award, at ImpactHack 2026**.

> **Tip:** open the live demo in a private or incognito window for a clean start. Smart Import shares a small free AI budget and is rate limited, so it may show "daily AI budget used" if many people try it. The demo video shows the full flow.

## The problem

Students don't just have too many assignments. They don't know what to do first. Their school information is scattered across Google Classroom, Canvas, email, screenshots and notes, and sorting by due date ignores how long each task takes and how much else is due around it.

## What ClassVault does

- **Quick Save** an assignment, note, link, photo or file in a few taps, organized by class.
- **Vault, Classes and Search** to find anything later, with filters for class, type, status and due date.
- **Smart Import (AI):** paste messy assignment text and get reviewable tasks. Nothing is saved until the student confirms.
- **Workload plan:** a ranked "what to do first" list with a start-by day and a plain-language reason for each task.
- **Learns from the student:** after finishing a task and saying how long it took, future time estimates for that class improve.
- **Local-first:** the vault stays on the device, with no account, no ads and no tracking.

## Try it in 3 minutes

1. Open the live demo, finish the short onboarding, and add a class such as "Chemistry".
2. On Home, tap **Smart Import**, accept the notice, and paste this text:

   > Chem lab due Friday, around 45 mins. Geometry worksheet 7.3 is due tomorrow. For AP World I need to read chapters 4-5 by Monday and answer the questions at the end.

3. Review and edit the extracted tasks, then tap **Add to ClassVault**. The workload plan opens.
4. On the plan screen, change the hours you can work per day and watch the order change.
5. Tap **Load demo data (for judges)** to see what ClassVault has learned from past tasks. This history is sample data and is labeled as such.

## How it works

### Adaptive Workload Engine

This part is statistics plus scheduling logic. It is **not machine learning**, and no model was trained.

1. **Predict the time.** For each class we average `actual / estimate` from finished tasks (clamped to 0.4x to 3x) and blend it with the student's overall ratio using a prior weight of 2. With little history the prediction stays near the student's own estimate, and it adapts as history grows. With no estimate it assumes 45 minutes.
2. **Schedule backward.** Given the hours the student can work each day, work is placed starting from the latest due date and filling days backward. The day a task's work must begin is its *start by* day. Work that cannot fit is flagged with how many minutes it is short.
3. **Rank and explain.** Tasks are ordered by overload, then start-by day, then due date. Each reason is generated from the numbers, so nothing is invented.

### Smart Import (generative AI)

Smart Import uses **Meta Llama 3.1 8B Instruct** (`@cf/meta/llama-3.1-8b-instruct-fast`) on **Cloudflare Workers AI**. **Built with Llama.** The plain `llama-3.1-8b-instruct` was retired by Cloudflare on 2026-05-30, so the `-fast` variant is used.

    Student -> ClassVault Smart Import -> Cloudflare Worker
                                            |- input validation
                                            |- rate limits (before any AI call)
                                            '- Workers AI (Llama 3.1, JSON mode)
                                                  -> output validation -> Review screen
                                                  -> ClassVault -> Workload Engine

- **AI understands text, code does the planning.** The AI only reads messy text. Scheduling is deterministic code, which makes it predictable and explainable.
- **Dates are resolved by code, not the model.** The model only quotes the deadline words ("Friday"), and the Worker turns them into a date. Any date or class that the pasted text does not support is dropped, so unknown fields stay blank.
- **Validated three times:** JSON mode on the request, strict checks on the server, and checks again in the app. If JSON mode fails, the Worker retries once without it and validates the same way.
- **Student stays in control.** Nothing is auto-saved, and the pasted text is treated as data, not instructions.
- **No API key.** The Worker reaches the model through a Cloudflare binding, so there is no key to create, store or leak.
- **Graceful failure.** If Smart Import is unavailable or the free daily budget is used up, the app says so and the rest of ClassVault works normally.

**Rate limits** are enforced on the server before the AI is called (set in `worker/wrangler.toml`):

| Limit | Default |
|---|---|
| Requests per minute / day per device | 3 / 10 |
| Requests per minute / day per IP | 9 / 30 |
| Global AI requests per day | 100 |
| Input size / output tokens | 4000 characters / 1500 |

There are no accounts, so a "device" is a random id the app generates. It is only a rate-limit bucket, and the IP and global limits stop it being bypassed. Exceeding a limit returns HTTP 429.

## AI disclosure: what is original, what is AI-generated, what is third-party

**AI tools used while building:** ChatGPT (brainstorming and troubleshooting) and **Claude**, which was my primary coding assistant. **Claude wrote most of the application's code, including the Cloudflare Worker and the automated tests, based on the requirements and decisions I gave it.**

**AI inside the app:** Smart Import uses Meta's Llama 3.1 model through Cloudflare Workers AI.

**What I did myself:**
- Identified the problem and defined the product for ClassVault 1.0 and 2.0, including the core workflows.
- Set the rules the work had to follow: local-first student data, no paid services, no accounts, students review AI output before it is saved, and AI is kept separate from scheduling.
- Chose the services after reading their terms, and rejected AI services whose terms did not fit an app for students.
- Set up and ran the deployments (the Cloudflare Worker, the web demo and this GitHub repository) and submitted the iOS app to Apple.
- Tested the app and read the logs when Smart Import failed. They showed the model identifier had been retired, and we fixed it by switching to a supported version.
- Recorded the demo video and wrote the submission answers.

**Third-party components:** Meta Llama 3.1 (Llama 3.1 Community License and Acceptable Use Policy: <https://github.com/meta-llama/llama-models/blob/main/models/llama3_1/LICENSE>), Cloudflare Workers, Workers AI, Workers KV and Pages, and Capacitor. jsdom is used only for tests. The Swift files in `ios/` were generated by Capacitor.

## Project history

- **ClassVault 1.0** was created a few days before the ImpactHack hackathon started (git tag `v1.0-pre-hackathon`). It was submitted to Apple for App Store review.
- **ClassVault 2.0** was built during ImpactHack 2026 (October 1-7), adding Smart Import, the Workload Engine, estimated-time tracking, and automated tests.
- **Congressional App Challenge 2026:** this repository is the submission (git tag `v2.0-cac-2026`).
- **Roadmap:** Smart Import sends pasted text to an AI service, so before it reaches students in an App Store release, the privacy policy and the App Store privacy answers must be updated and reviewed.

## Privacy

The vault is stored on the device (localStorage and IndexedDB), with no accounts, analytics or ads, and no sync. **The one exception is Smart Import:** when a student chooses it and accepts the on-screen notice, the pasted text is sent to the Worker and processed by Cloudflare Workers AI. We do not store it, and Cloudflare's documentation says it does not use Workers AI content to train models. Students are told not to paste private information.

## Accuracy and limitations

- The Workload Engine has not been validated on a real student population. The demo history is synthetic and written to show the effect.
- It only learns from estimates and times that students enter, and it cannot see task difficulty.
- Start-by dates are "latest possible" days, with no safety buffer yet.
- An 8B model is weaker than the largest models. Smart Import can miss or merge tasks on messy input and give uneven time estimates, which is why students review before saving. The automated tests mock the model, so extraction quality has only been checked by hand against the live Worker.
- Vault data is local, so it does not sync between devices.
- Rate limits use Workers KV counters, which are not atomic, so they are approximate under bursts.

## Tech stack

- **Languages:** JavaScript, HTML and CSS.
- **Platforms:** web, and iOS through Capacitor.
- **Storage:** localStorage and IndexedDB.
- **Backend for Smart Import:** Cloudflare Worker, Workers AI and Workers KV.
- **Hosting:** Cloudflare Pages for the web demo.
- **Tests:** Node's built-in test runner with jsdom (`npm test`).

## Repository layout

    www/index.html      the whole app (HTML, CSS and JavaScript)
    ios/                Capacitor iOS project (open in Xcode)
    worker/src/         Cloudflare Worker for Smart Import
    worker/test/        Worker tests
    worker/scripts/     live test against the deployed Worker
    tests/              app tests: workload engine, UI, Smart Import end to end
    capacitor.config.json, package.json

## Run it yourself

- **Web:** open `www/index.html` in a browser.
- **Tests:** run `npm install`, then `npm test`.
- **iOS:** run `npx cap sync ios`, then `npx cap open ios` (needs Xcode).
- **Deploy the Worker:**

      cd worker
      npm install --save-dev wrangler
      npx wrangler login
      npx wrangler kv namespace create RATE_KV   # paste the id into wrangler.toml
      npx wrangler deploy

  Put the printed address, plus `/api/smart-import`, into `SMART_IMPORT_URL` in `www/index.html`.
- **Live test against the real model:** `WORKER_URL=https://<your-worker>/api/smart-import node worker/scripts/live-test.mjs`

## License

No open-source license has been added yet, so all rights are reserved by the author. Third-party components keep their own licenses.
