# GitHub Pages

The site is static and uses relative asset URLs, so it works at either an account
root or a repository subpath. The [Pages workflow](../../.github/workflows/pages.yml)
runs `npm run verify`, uploads `dist/`, and deploys it. No API keys or application
secrets are needed.

A workflow file alone does not publish a demo. This source snapshot has no confirmed
public deployment; use the URL reported by a successful deployment before adding
a demo link to the README.

## Existing GitHub repository

1. Commit the source and connect it to the intended remote. Check `git remote -v`
   before changing an existing remote.
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
3. Push to `main`, or run **Publish to GitHub Pages** from the Actions tab.
4. Open the URL shown by the successful `github-pages` deployment.
5. Add that URL to the README's demo section and the repository's website field.

The build job has read-only repository access. Only the deploy job gets
`pages: write` and `id-token: write`. Deployment runs on `main` pushes or manual
dispatch, not pull requests. Actions are pinned to commit hashes.

See GitHub's [custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
for repository settings and deployment permissions.

## New GitHub repository

For a source directory without Git history:

```sh
git init -b main
git add .
git diff --cached --stat
git commit -m "Initial crosshair converter"
```

Review staged files before committing. The helper below creates a **new public**
repository under the owner you supply. It requires an authenticated GitHub CLI:

```sh
gh auth login
bash scripts/publish-github.sh YOUR_ACCOUNT/small-indie-crosshair-company --create-public
```

The helper requires a clean `main` branch, refuses an existing `origin` or GitHub
repository, verifies the project, creates the repository, enables Pages, and pushes.
If it stops after creating the repository, inspect the remote state before retrying;
it does not delete or overwrite repositories. If you cloned from a local Git bundle,
inspect its `origin` and remove it only if it still points to that local bundle.

## Check the deployed demo

Open the actual Pages URL on desktop and mobile. Paste a legacy code, change the
resolution, compare previews, and export a config. Open the source settings and
mathematics pages. Confirm the worker and data requests succeed under the repository
subpath, and check the console for errors.

Test an original PNG import and a separately labeled synthetic measurement file.
Synthetic records must not update native model weights. Record the deployed commit
and URL when reporting results. Local screenshots do not establish hosted behavior.

## Hosting limits

GitHub Pages serves HTTPS but does not offer arbitrary response-header configuration.
The HTML includes a meta CSP; directives such as `frame-ancestors` require HTTP
headers and cannot be enforced there. See [static hosting](deployment.md) for the
full header policy on hosts that support it.

Screenshot hashing needs a secure context. Workers, scripts, and JSON are same-origin;
a host that blocks workers or assigns incorrect MIME types can prevent startup.
The local Node server is a development tool, not a public hosting service.
