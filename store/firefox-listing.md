# addons.mozilla.org listing

What goes into each field of the add-on's page on addons.mozilla.org
(AMO), in the order the Developer Hub asks for them. The description
field takes a small set of HTML (`<b>`, `<i>`, `<code>`, `<ul>`, `<li>`,
`<a>`, `<blockquote>`) and no Markdown, so it is written in that.

## Name

```
hbs2-hub
```

## Add-on URL (slug)

```
hbs2-hub
```

## Summary

At most 250 characters.

```
Shows a repository's hbs2 issues and pull requests on its GitHub pages, in GitHub's own lists and threads, and lets you comment, file, propose, review and merge them, signed by your own keys. No account, no server, no GitHub token.
```

## Description

```
<b>hbs2-hub</b> puts a repository's <a href="https://github.com/NCrashed/hbs2">hbs2</a> issues and pull requests on its GitHub pages.

hbs2 is a peer-to-peer storage network, and hbs2-hub is its forge: issues and pull requests that live inside the git repository they are about. Anyone can file one without an account; it arrives as an encrypted, signed letter, and a maintainer accepts it into the repository's record. There is no server to run and no service to depend on.

Many projects keep their code on GitHub and their tracker on hbs2. This extension shows the hbs2 side next to the GitHub side, so nobody has to leave the page:

<ul>
<li>the hbs2 threads in GitHub's own issue and pull request lists, marked <b>hbs2</b>, following GitHub's Open and Closed tabs and its search;</li>
<li>a thread drawn in place, laid out like a GitHub issue: the conversation, labels, assignees, and for a pull request its Files changed tab with the diff;</li>
<li>a comment box under every thread, with Write and Preview;</li>
<li>new issues and pull requests, including one of GitHub's own pull requests proposed on hbs2;</li>
<li>for a maintainer: merge, close and reopen, labels and assignees, redaction, the inbox of waiting letters, and the list of maintainers.</li>
</ul>

<b>Nothing is signed without you.</b> Text is typed once, on the GitHub page. A separate window then shows a dry run of exactly what will be signed and published, and only its button signs. The GitHub page itself can only read.

<b>Your keys stay where they are.</b> The extension holds no keys and does no cryptography. It talks over the browser's native messaging to the <code>hbs2-hub</code> program on your computer, which signs as it does on the command line.

<b>What you need</b>
<ul>
<li>hbs2 0.26.0.2 or newer, with a running <code>hbs2-peer</code>: <a href="https://github.com/NCrashed/hbs2/releases">releases</a>, Homebrew on Apple Silicon, or Nix;</li>
<li>an identity: <code>hbs2-hub identity init</code>;</li>
<li>the browser connection, once: <code>hbs2-hub native-host --install</code>;</li>
<li>to write to a repository, a clone of it, named with <code>git config --global hbs2-hub.&lt;repo-key&gt;.clone &lt;dir&gt;</code>.</li>
</ul>

A GitHub repository says where its hbs2 side is with a one-line file, <code>.hbs2/hub</code>. The extension remembers the key the first time it sees it and warns if the file later names another.

Source, documentation and issues: <a href="https://github.com/NCrashed/hbs2-hub-browser">github.com/NCrashed/hbs2-hub-browser</a>.
```

## Categories

```
Web Development
```

## Tags

```
github, git, hbs2, p2p, decentralized, issues, pull requests, code review
```

## Support

- Homepage: `https://github.com/NCrashed/hbs2-hub-browser`
- Support site: `https://github.com/NCrashed/hbs2-hub-browser/issues`
- Support email: leave empty, or the address you want people to write to.

## License

```
BSD-3-Clause
```

## Privacy policy

The text of `PRIVACY.md`.

## Screenshots

In `store/screenshots/`, 1280 x 800. Captions:

1. `1-list.png`: The hbs2 threads in GitHub's own pull request list, marked hbs2.
2. `2-thread.png`: A pull request drawn in place, like a GitHub one: the conversation, labels, the merge.
3. `3-files.png`: Files changed, from the diff the proposal carries.
4. `4-comment.png`: A comment, written under the thread with Write and Preview.
5. `5-review.png`: Before anything is signed: a dry run of exactly what will be written and published.
6. `6-inbox.png`: A maintainer's inbox: a contributor's letter, opened whole, to accept or reject.

## Source code

Upload `hbs2-hub-<version>-source.zip` from the release: AMO asks for the
sources because the code is bundled.

## Notes to reviewer

```
WHAT IT IS. The extension shows hbs2-hub issues and pull requests on GitHub pages. It does no cryptography and holds no keys: every read and write goes over native messaging (host name app.hbs2.hub) to the hbs2-hub program, the user's own command-line tool, which is open source: https://github.com/NCrashed/hbs2 (the native host is hbs2-hub/ingress/HBS2/Hub/NativeHost.hs).

PERMISSIONS.
- nativeMessaging: the only way it reaches hbs2-hub.
- storage: the hbs2 key each GitHub repository pointed to when first seen, and the user's own mappings from the options page.
- https://github.com/*: the content script that draws on GitHub pages.
- https://raw.githubusercontent.com/*: reading a repository's one-line .hbs2/hub file, without cookies.
No remote code, no analytics, no other network access. Content from the hub (titles, comments, diffs) is inserted as text nodes and through the extension's own small Markdown reader that builds DOM nodes; there is no innerHTML anywhere.

WRITES. A GitHub page can only read: the background script refuses any tool that writes when the request comes from a content script. Writes come from the extension's own pages (compose, inbox, maintainers), after a review that shows a dry run of exactly what will be signed.

BUILD FROM SOURCE. Node 24:
  npm ci
  npm run build
The Firefox build is dist/firefox. The bundle is made by esbuild without minification, from src/; package-lock.json pins every version. npm run check also runs the type checker and the tests.

HOW TO TRY IT. Without hbs2-hub on the machine the extension shows that it cannot reach the host, with the command to install it. To see it working:
1. Install hbs2 0.26.0.2 (https://github.com/NCrashed/hbs2/releases, amd64 Linux tarball) and start hbs2-peer as its README says.
2. hbs2-hub identity init
3. hbs2-hub native-host --install   (after Firefox has been started once)
4. Open https://github.com/NCrashed/hbs2-hub-browser/pulls : the extension's own repository keeps its pull requests on hbs2, and one appears in the list marked hbs2. Clicking it opens the thread in place.
Reading needs no clone and no account; the host fetches the repository over hbs2 by itself.
```

## Release notes for 0.1.0

```
First release. hbs2 threads in GitHub's issue and pull request lists, threads drawn in place, comments, new issues and pull requests, and the maintainer's merge, close, labels, assignees, redaction, inbox and maintainers. Needs hbs2-hub 0.26.0.2 or newer.
```
