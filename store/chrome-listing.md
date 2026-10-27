# Chrome Web Store listing

The Chrome Web Store takes the description as plain text: no HTML and no
Markdown, line breaks kept. The short summary is not entered here: the
store shows the manifest's `description`, from package.json (at most 132
characters). Screenshots: `store/screenshots/`, up to five; captions as in
`firefox-listing.md`.

## Description

```
hbs2-hub puts a repository's hbs2 issues and pull requests on its GitHub pages.

hbs2 is a peer-to-peer storage network, and hbs2-hub is its forge: issues and pull requests that live inside the git repository they are about. Anyone can file one without an account; it arrives as an encrypted, signed letter, and a maintainer accepts it into the repository's record. There is no server to run and no service to depend on.

Many projects keep their code on GitHub and their tracker on hbs2. This extension shows the hbs2 side next to the GitHub side, so nobody has to leave the page:

* the hbs2 threads in GitHub's own issue and pull request lists, marked hbs2, following GitHub's Open and Closed tabs and its search
* a thread drawn in place, laid out like a GitHub issue: the conversation, labels, assignees, and for a pull request its Files changed tab with the diff
* a comment box under every thread, with Write and Preview
* new issues and pull requests, including one of GitHub's own pull requests proposed on hbs2
* for a maintainer: merge, close and reopen, labels and assignees, redaction, the inbox of waiting letters, and the list of maintainers

NOTHING IS SIGNED WITHOUT YOU. Text is typed once, on the GitHub page. A separate window then shows a dry run of exactly what will be signed and published, and only its button signs. The GitHub page itself can only read.

YOUR KEYS STAY WHERE THEY ARE. The extension holds no keys and does no cryptography. It talks over the browser's native messaging to the hbs2-hub program on your computer, which signs as it does on the command line.

WHAT YOU NEED

* hbs2 0.26.0.2 or newer, with a running hbs2-peer: https://github.com/NCrashed/hbs2/releases, Homebrew on Apple Silicon, or Nix
* an identity: hbs2-hub identity init
* the browser connection, once: hbs2-hub native-host --install
* to write to a repository, a clone of it: git config --global hbs2-hub.<repo-key>.clone <dir>

A GitHub repository says where its hbs2 side is with a one-line file, .hbs2/hub. The extension remembers the key the first time it sees it and warns if the file later names another.

Source, documentation and issues: https://github.com/NCrashed/hbs2-hub-browser
```

## Category

```
Developer Tools
```

## Privacy practices tab

Single purpose:

```
Show a repository's hbs2-hub issues and pull requests on its GitHub pages, and let the user read and write them through the hbs2-hub program on their own computer.
```

Permission justifications:

- nativeMessaging:
  ```
  The only way the extension reaches hbs2-hub, the user's own command-line program, which reads the repository's issues and pull requests and signs what the user writes. The extension itself holds no keys.
  ```
- storage:
  ```
  Remembers the hbs2 key each GitHub repository pointed to when first seen, so a changed pointer can be warned about, and the user's own repository mappings from the options page.
  ```
- Host permission https://github.com/*:
  ```
  The content script that adds the hbs2 issues and pull requests to GitHub's repository pages.
  ```
- Host permission https://raw.githubusercontent.com/*:
  ```
  Reads a repository's one-line .hbs2/hub file, which says where its hbs2 side is. Fetched without cookies.
  ```
- Remote code: No. Everything the extension runs is in the package.

Data usage: tick nothing collected, and certify the three statements (no
selling, no use unrelated to the single purpose, no creditworthiness).

Privacy policy URL:

```
https://github.com/NCrashed/hbs2-hub-browser/blob/master/PRIVACY.md
```

## Notes for the reviewer

The "Notes to reviewer" text in `firefox-listing.md` holds for Chrome too:
what the native host is, the permissions, and how to try it on the
extension's own repository.
