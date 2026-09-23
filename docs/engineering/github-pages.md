# GitHub Pages

The public demo is <https://sebastianspicker.github.io/small-indie-crosshair-company/>.
The site uses relative asset URLs, so it works under a repository subpath.

## Deploy changes

The [Pages workflow](../../.github/workflows/pages.yml) runs `npm run verify`,
builds `dist/`, and deploys it. It runs on pushes to `main` and can be started
from the Actions tab. Check the workflow run before sharing a deployment URL.

The build job has read-only repository access. Only the deploy job receives
`pages: write` and `id-token: write`. All third-party actions are pinned to
commit hashes. No application secrets are needed.

GitHub Pages cannot set arbitrary response headers. The HTML includes a meta CSP,
but directives such as `frame-ancestors` require HTTP headers. See
[static hosting](deployment.md) for the full header policy on other hosts.

For setup details, see GitHub's
[custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
