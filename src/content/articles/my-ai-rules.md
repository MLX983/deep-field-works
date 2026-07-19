---
title: My AI Rules
description: The control surface must make AI authority legible without exposing the machinery as a technical permission system.
draftDate: 2026-07-14
updatedDate:
draft: true
documentType: prototype-note
theme: supervision-interfaces
status: draft
sourceNote: "Intake issue #17 — https://github.com/MLX983/dfw-intake/issues/17"
domainPath:
  - "Interfaces for Judgment"
relatedConcepts:
  - "supervision-interfaces"
relatedPieces: []
canonical: false
---

# My AI Rules

## The design problem

A personal AI can know things, use services, and act across several parts of a person's life. The controls for that authority need to be understandable at a glance. The problem is not exposing every permission or technical dependency. It is helping a person see what is allowed, what requires permission, and what is off-limits without managing the AI like a system administrator.

## The interaction choice

The proposed screen is called My AI Rules. It frames control as a set of ordinary-language house rules. The user describes what the AI may know, use, and do, then identifies the situations where it must stop and ask. The interface keeps those boundaries visible instead of burying them in a general settings system.

## How the control surface is grouped

### What my AI knows

- Name, family, projects, schedule, likes, and writing style use three states: Keep, Ask first, or Forget.

### What my AI can use

- Calendar, email, notes, photos, location, and contacts use three states: Yes, Ask me, or No.

### What my AI can do

- Helping the user think, drafting messages, creating reminders, organizing things, suggesting plans, and talking to other apps use three states: Always okay, Ask first, or Never.

### Before you act, ask me if

- The action concerns money, family, health, or work.
- The action contacts another person or changes or deletes something.

## Why it matters

The control surface must make AI authority legible without exposing the machinery as a technical permission system.

The larger design move is from configuring machinery to teaching a helper the house rules. The language is direct, and the boundaries remain visible. That does not remove the underlying complexity. It gives the user a legible surface for authority and a basis for checking whether the AI complied.

## Current state

This is a proposed control-surface structure drawn from the intake issue. It has not been implemented or tested. The labels, state distinctions, and compliance feedback still require interaction design and user review.

## Remaining questions

Would people understand the difference between Ask first and Ask me across knowledge, access, and action?

How should the interface show that the AI complied with a rule after an action occurs?

Which sensitive actions need categories beyond the proposed money, family, health, work, contact, change, and deletion boundaries?
