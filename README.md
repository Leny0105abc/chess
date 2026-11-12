# ChessMaster Academy

An interactive chess academy with three learning paths, guided practice, opening study, timed tactics, endgames, and a Stockfish analysis board. The guest experience runs without accounts or paid services.

## Run locally

Use Node.js 24 LTS and npm.

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite. Guest progress, settings, and repertoire are saved in the current browser. To exercise the installable app and service worker, use the production build.

```sh
npm run build
npm run preview
```

The first successful production visit caches the academy routes, lesson and puzzle content, fonts, pieces, and dashboard artwork. Core training remains available offline once the service worker takes control. Stockfish downloads only when play or evaluation first needs it and is then cached. Registration, account synchronization, classrooms, custom publications, and shared standings require internet access and Supabase.

## Connect Supabase

1. Create a Supabase project or start a local Supabase stack with Docker and the Supabase CLI.
2. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the project URL and publishable key. The legacy anon key also works. Keep every secret and service-role key in Supabase's server environment.
3. For local Supabase, run `supabase start` and `supabase db reset`. For a hosted project, run `supabase link --project-ref <project-ref>` and `supabase db push --include-seed`.
4. Deploy the custom content validation function with `supabase functions deploy publish-content --no-verify-jwt`. The function verifies each user token through Supabase Auth, checks the caller's database role, and uses the platform-provided service credential only inside the function.
5. In Authentication URL Configuration, set the site URL and allow the local and deployed `/account` and `/account?mode=reset` redirect URLs. Configure email delivery and confirmation settings for your deployment.
6. After creating and verifying the first administrator account, use the SQL editor to grant the role. Obtain the user's UUID from Authentication, not from user-supplied metadata.

```sql
update public.academy_state
set role = 'admin'
where user_id = '<administrator-user-uuid>';
```

Use **Administration → Users** to grant coach access. Coaches can create a class, share an invitation code, assign academy activities, and export class progress. To create sample assignments for an existing coach, run `supabase/examples/classroom.sql` after replacing its example UUID.

Account and guest workspaces are isolated. Account progress merges by activity key and timestamp, and repertoire edits and deletions use per-entry timestamps. Local changes are retained if the service is unavailable. Classroom reports display learner workspace progress. Shared standings count distinct puzzles verified against server-side solution keys and show only opted-in display names. Personal quiz and training scores are practice records. The leaderboard does not accept client-supplied points, accuracy, or ratings.

## Deploy the frontend to Vercel

Import the repository using Vercel's **Vite** preset. Use `npm run build`, output directory `dist`, and the two `VITE_SUPABASE_*` variables above if account features are enabled. `vercel.json` supplies SPA deep links. Set the Supabase auth redirect allowlist after you know the final domain. Verify email confirmation, recovery, class invitations, custom publishing, and synchronization in the deployed environment.

## Tests and validation

```sh
npm run validate
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Set `PLAYWRIGHT_CHROME` to a Chromium executable to test an existing browser. The tests cover rules, PGN round trips, Postgres row-level security, guest learning, opening playback and practice, mobile puzzles, worker-backed computer play, and production offline navigation. Postgres tests use PGlite with a minimal Auth schema. Email delivery and hosted Supabase Auth require a configured project.

The validator replays every included move with Chess.js and checks starting positions, SAN/UCI/FEN consistency, opening length, content minimums, puzzle uniqueness, and the final checkmate on mate-tagged puzzles. Run `npm run validate -- --seed` to update the server's puzzle solution keys after changing the seed data.

### Content workflow

- Edit courses and endgames in `src/data/courses.ts`. Use `npx tsx scripts/check-endgames.ts` to refresh tablebase results after changing endgame positions.
- Download the five TSV files `a.tsv` through `e.tsv` from [Lichess chess-openings](https://github.com/lichess-org/chess-openings) into `.cache`. Edit `scripts/opening-seeds.txt` and run `node scripts/import-openings.mjs .cache`. The importer first tries named Lichess lines. It labels shorter branches extended by Stockfish as practice continuations.
- Download the public Lichess puzzle CSV or its `.zst` archive. Run `node scripts/import-puzzles.mjs <path>` to select a theme- and difficulty-balanced subset. The source move is applied before the position is shown. Run `node scripts/verify-puzzles.mjs 10` to screen for similar winning continuations using Stockfish, then regenerate the server keys. The puzzle solver also checks equivalent forced mates within a bounded search.
- Administrators can build and publish additional board demonstrations, with explanations per half-move, through **Administration → Content**. Published demonstrations appear in **Chess Resources**. Core curriculum edits use the versioned content workflow above.

### Engine evaluations

Computer difficulty uses search depth, Stockfish skill, and weaker move selection in the lowest tiers. The displayed puzzle rating is a local training estimate based on first attempts. Game review compares fixed-depth evaluations from the moving side and classifies centipawn losses of up to 10, 25, 60, 120, and 250 as Best Move, Excellent, Good, Inaccuracy, and Mistake. Larger losses are Blunders. Mate scores use a large signed value for classification. Engine scores may change as search depth increases.

### Credits and licenses

- [Lichess Open Database](https://database.lichess.org/) and [Lichess chess-openings](https://github.com/lichess-org/chess-openings) supply CC0 puzzle records, opening names, and opening scores. Each puzzle links to its source game.
- Endgame outcomes come from the [Lichess Syzygy tablebase](https://github.com/lichess-org/lila-tablebase).
- [FIDE Laws of Chess](https://handbook.fide.com/chapter/e012023), effective 1 January 2023, is the tournament-rules reference.
- The chess pieces are the Cburnett set distributed by [Lichess](https://github.com/lichess-org/lila/tree/master/public/piece/cburnett). The [original piece artwork](https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces/Standard_transparent) is available under CC BY-SA. The application uses the assets under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- DM Sans and Playfair Display are distributed under the SIL Open Font License. The license texts are in `public/fonts`.
- The Stockfish 17.1 Lite single-threaded WASM build is distributed under GPLv3. The built site includes its license at `/engine/COPYING.txt`. The corresponding engine source and build instructions are available from the [Stockfish.js 17.1 release](https://github.com/nmrugg/stockfish.js/releases/tag/v17.1.0).
- The dashboard banner was generated for ChessMaster Academy.
