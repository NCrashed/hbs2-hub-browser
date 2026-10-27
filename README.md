# hbs2-hub for the browser

A Firefox and Chrome extension that shows a repository's
[hbs2-hub](https://github.com/NCrashed/hbs2/blob/master/docs/hbs2-hub.md)
issues and pull requests on its GitHub pages.

Many projects keep their code on GitHub and their issues and pull
requests on hbs2, where anyone can file them without an account and the
record lives inside the repository. This extension puts the hbs2 side
next to the GitHub side, so readers do not have to leave the page.

The design is [PEP-24](https://github.com/NCrashed/hbs2/blob/master/docs/drafts/pep-24-hub-browser-extension.md).

## What it does now

Phase 1, reading:

- an **hbs2** tab in a repository's navigation;
- on `/issues` and `/pulls`, the hbs2 threads in GitHub's own list
  panel, each marked **hbs2**, following the Open/Closed tab and the
  search (state, `label:` and words in the title), with `+N hbs2` on the
  Open and Closed counts;
- a repository page with every hbs2 issue and pull request;
- a thread page: title, status, labels, body, comments, and for a pull
  request its coordinates and diff, each item attributed to the key that
  wrote it and the key that accepted it.

Writing (PEP-24 phases 2 and 3):

- **New issue on hbs2** and **New pull request on hbs2** in the list
  panel, and under every thread a comment box with Write and Preview;
- text is typed once, on the page. The extension's window opens on the
  review: what will be signed, as a dry run, and the button that signs.
  Canon is published after a canon write;
- a maintainer's issue or comment goes straight into canon; anybody
  else's goes to the project's mailbox as a letter and shows up once a
  maintainer accepts it;
- a pull request carries the commits of a branch of your working clone,
  or of another repository: on one of GitHub's own pull requests,
  **Propose on hbs2** takes its commits from GitHub's `pull/<n>/head`;
- for a maintainer: Merge (a merge commit, pushed to the hbs2 remote and
  to `origin`, recorded: `hbs2-hub pr land`), or record a merge made
  with git or on GitHub, from the thread or from the commit's page;
  Close and Reopen beside Comment; labels and the assignee in the side
  column; Redact on a comment;
- for a maintainer, an **Inbox** in the list panel: each waiting letter
  opened whole and accepted, rejected or honoured, and from there the
  **Maintainers**, added and removed by the owner.

Writing needs a working clone of the repository on your machine, named
with `git config --global hbs2-hub.<repo-key>.clone <dir>`, and an
identity (`hbs2-hub identity init`).

## How it works

The extension holds no keys and does no cryptography. It talks to
`hbs2-hub native-host` on your machine over the browser's native
messaging, and that runs the same verbs the `hbs2-hub` command line
does. GitHub pages can only ask it to read; anything that writes will
come only from the extension's own pages, after you confirm it.

A GitHub repository says where its hbs2 side is with a file at its root,
`.hbs2/hub`:

```
# hbs2-hub pointer: where this repository's issues and pull requests live
hbs23://7VM1rtxrTmpXYVidNFHu5ZbNqRKMhKoRAV8vJebGaRN9
```

The extension remembers the key the first time it sees it and warns if
the file later names another. You can also map a repository by hand in
the extension's options.

## Install

You need hbs2 0.26 or newer with a running `hbs2-peer`.

1. Build the extension:

   ```
   npm install
   npm run build
   ```

   This writes `dist/chrome` and `dist/firefox`.

2. Load it:
   - **Chrome / Chromium:** `chrome://extensions`, enable Developer
     mode, "Load unpacked", choose `dist/chrome`.
   - **Firefox:** `about:debugging#/runtime/this-firefox`, "Load
     Temporary Add-on", choose `dist/firefox/manifest.json`.

3. Let it reach hbs2-hub:

   ```
   hbs2-hub native-host --install --chrome-id llmffghhboheiadaadikapcdifeolepc
   ```

   This writes a small launcher and the host manifest for each browser
   you have. Run it again after upgrading hbs2.

4. Optional, for faster reads and for writes later: tell it where your
   clone of a repository is.

   ```
   git config --global hbs2-hub.<repo-key>.clone /path/to/clone
   ```

   Without it, the host keeps its own read-only clone under
   `~/.cache/hbs2-hub/repos/`.

## Develop

```
npm run check    # ASCII-only sources, types, tests, both builds
```

- `src/background.ts`: the one connection to the native host, and the
  rule that a GitHub page may only read.
- `src/content.ts`: what is added to GitHub pages.
- `src/pages/`: the repository, thread and options pages.
- `src/lib/`: the pointer file, the protocol, the documents, and the DOM
  helpers. Everything a stranger wrote is put on the page as text,
  never as HTML.

The Chrome build carries the public half of a key (`keys/`) so an
unpacked build has the same id everywhere; the native host's manifest
names that id.

## License

BSD-3-Clause, like hbs2.
