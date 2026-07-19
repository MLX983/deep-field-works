# Draft presentation plan v1

Draft presentation plans describe how existing draft content should appear in
the local review workflow. They do not replace or duplicate the article body.

## Dek behavior

`dek` is optional. Omitting it renders no visible dek.

Frontmatter `description` remains available for document metadata, but it is
not rendered as a dek unless the plan explicitly opts in with:

```ts
dek: { source: 'description' }
```

A plan may instead supply an explicitly reviewed dek with `dek: { text: ... }`.
There is no rule that every page needs a dek.

## Pull quotes

`pullQuotes` may be empty. There is no rule that every page needs a pull quote.

Each pull quote requires two explicit presentation decisions:

1. a selection from existing draft prose
2. a placement at a section or paragraph boundary

Selection and placement are likely human-review points. They depend on page
rhythm, surrounding context, repetition, and the length of the artifact, so
they should not be treated as fully deterministic decisions.

Pull quotes must not introduce or silently rewrite prose. They select from the
draft body using a section, paragraph, and optional sentence range.

## Callouts

Every callout selects a named `variant`; there is no universal callout visual.
The initial `operational` variant is a quiet, single-text-block treatment for an
approved operational principle or instruction. It has no label, icon, border,
radius, or shadow.

Callouts also make source handling explicit:

- `reference` displays the selected excerpt while leaving its source paragraph
  in normal article flow.
- `extract` moves the selected paragraph into the callout so the same prose is
  not rendered twice.

The source selection and placement remain presentation decisions. A callout
must not rewrite the selected prose or turn editorial notes into public copy.
