# Rules for Codex (and any belt worker) in `Toolchain/government`

1. Read `DESIGN.md` (the sections your task names) first. It is the spec. Disagree by parking in `HANDOFF.md`
   Blocked, never by changing DESIGN.md.
2. **No government type is ever assigned (Rex, 2026-10-31).** Never store or read a type, a legitimacy meter, a
   stability meter, a rebellion threshold or a power score. Authority is computed on read from owned state
   (DESIGN §1.2, GOV-Q1); the formula is provisional and swappable.
3. **Laws are executable data**, never free text code interprets and never a modifier on another engine's number.
   A law can exist and not be obeyed; breach, detection, prosecution and sanction are separate records (DESIGN §1.1).
4. Government decides no person's choice (Cognition) and no act's success (Reality, Life). Effects on other
   engines are commands to their owners (Settlement `pay`, `appoint`, `transfer`, ...), never writes.
5. Settlement keeps who holds an office, permits, titles, leases and money (`GOVERNMENT-SETTLEMENT.md`, DUP-62).
   Never keep a second copy.
6. `src/` imports only `@rex/kernel` and its own files. Other engines are reached through ports with stub providers
   in tests. Never a game, never pirate-ship.
7. Deterministic: no `Math.random`, no `Date.now`; randomness only from kernel streams; outputs sorted by id.
8. Never invent a value, rate, threshold or historical rule. A missing value is `null` with a note; a historical law
   cites its source.
9. Style: TypeScript, ES modules with `.ts` import suffixes, small files, one test file per source file in `test/`,
   test titles naming the rule they check.
10. Run only your own tests while working (`npx vitest run test/<file>.test.ts`); the runner runs the Gate.
11. Never edit another repo.
12. One commit, not pushed, ending with `Co-Authored-By: OpenAI Codex <codex@openai.com>`. Nothing left uncommitted.
    Close with a short report: done or parked, tests, commit hash.
13. Never commit a failing test: if an assertion the spec requires can't hold without retuning, leave the work uncommitted and report the reason as a failure.
