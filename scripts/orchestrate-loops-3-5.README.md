# Loops 3–5 — Local Orchestration MVP

This command executes the controlled local workflow once: Loop 3, then Loop 4, then Loop 5 only when Loop 4 returns `REVISE`.

```bash
npm run loop:orchestrate -- \
  --packet /tmp/loop2-packet.json \
  --issue /tmp/source-issue.md \
  --recommendation /tmp/approved-loop1-recommendation.json \
  --out-root /tmp/dfw-run
```

It creates `loop3/`, `loop4/`, and—only when needed—`loop5/`. It preserves each runner's outputs, exit code, contracts, and content-integrity checks. Raw subprocess stdout and stderr bytes are written to `<stage>-stdout.log` and `<stage>-stderr.log`, including empty files when a stream is empty. The manifest references those paths instead of embedding diagnostic content. It performs no retries, model calls, GitHub access, publication, or automatic Loop 4 reevaluation.

The root manifest inventories every stage artifact with an exact SHA-256 content-integrity fingerprint and records the terminal workflow boundary. Log files are classified as diagnostic artifacts; their hashes verify inventory bytes only and never participate in workflow-integrity decisions or combined provenance hashes. The manifest does not fingerprint itself.
