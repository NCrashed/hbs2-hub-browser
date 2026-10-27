# Privacy

hbs2-hub for the browser collects nothing and sends nothing anywhere.

What it reads:

- the GitHub pages you open, to put a repository's hbs2 issues and pull
  requests on them;
- the repository's `.hbs2/hub` file, from `raw.githubusercontent.com`,
  without cookies, to find its hbs2 side.

What it talks to: only the `hbs2-hub` program on your own computer, over
the browser's native messaging. That program reads and writes your
local clones and your local hbs2 peer, as it does on the command line.
Nothing is signed or sent without your confirming it on the extension's
review.

What it keeps: in the browser's extension storage, the hbs2 key each
GitHub repository pointed to when you first opened it, and any mapping
you set in its options. Nothing else.

No analytics, no remote code, no third-party services.
