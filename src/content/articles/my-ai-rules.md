---
title: From Chatbot to Personal AI
description: An AI that knows how you want things done.
draftDate: 2026-07-14
updatedDate:
draft: true
documentType: prototype-note
theme: supervision-interfaces
status: review
sourceNote: "Intake issue #17: https://github.com/MLX983/dfw-intake/issues/17"
domainPath:
  - "Interfaces for Judgment"
relatedConcepts:
  - "supervision-interfaces"
relatedPieces: []
canonical: false
---

Most chat AI waits for a request. Users open a conversation, explain what is going on, ask for something, and receive a response. The next task often begins with another conversation and another round of context.

A personal AI would remember users' preferences and ongoing projects, use the services they already rely on, and handle routine actions without being prompted each time.

Users shouldn't have to keep supplying the same background or starting every small task. Connections, preferences, and limits can be set in advance, and the AI can proceed because its mission has already been defined.

For a consumer product, those settings need to stay simple, focused on four things:

- what the AI knows about them
- what information, tools, or services it can use
- what it may do independently
- where its authority stops

Take a hypothetical dentist appointment. I have already allowed the AI to use my calendar, contact ordinary service providers, and reschedule routine appointments. When a conflict appears, it moves the appointment and records what changed. There is no reason to interrupt me for permission I have already given.

The limits show up when the task changes. Cancelling an important appointment, paying a large fee, or sharing medical details may go beyond what I allowed. That is when the AI should stop and bring the decision back to me.

A future settings page could make these standing instructions easy to set, review, and change. It would also need to show which instruction led to an action. The exact settings and behavior would need to be designed and tested.

The AI should know how users want ordinary things handled and take care of them on its own. It should also know when something is important enough to bring back to them.
