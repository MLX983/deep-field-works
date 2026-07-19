# Issue #9601: Visible review boundary

- **Number:** 9601
- **Title:** Visible review boundary
- **Labels:** intake, prototype-note
- **Created:** 2026-01-04T00:00:00.000Z
- **URL:** https://example.invalid/issues/9601

---

### Body

Observation: A review control is difficult to use when pending actions and their approval states are separated.

Working model: Keeping the action and its review boundary together may make delegated authority easier to inspect.

Open question: Does a compact review panel make the approval boundary clear without adding unnecessary controls?

## The design problem

A reviewer needs to see which proposed actions require a decision without opening a separate detail view for each action.

## The interaction choice

The proposed panel groups pending actions by review state and keeps the available decision beside each action.

## How the control surface is grouped

### Needs review

- Show actions that cannot proceed without a reviewer decision.
- Keep approve and decline controls beside the action they affect.

### Already resolved

- Show recently approved or declined actions as read-only history.

## Design principles

- Keep the decision boundary visible.
- Distinguish proposed behavior from implemented behavior.

## Current state

This is a proposed interaction structure. It has not been implemented or tested.

---
