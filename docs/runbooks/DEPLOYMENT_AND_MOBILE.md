# Deployment and phone installation

## GitHub Pages

The checked-in workflow `.github/workflows/deploy-pages.yml` builds, tests, and publishes the PWA after changes reach `main`. Before enabling it, add these GitHub repository variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Set GitHub Pages source to **GitHub Actions**. In Supabase Auth URL configuration, add the deployed repository URL and these redirect URLs:

- `https://<account>.github.io/<repository>/confirm-email`
- `https://<account>.github.io/<repository>/reset-password`

The build supplies a repository basename, relative manifest/icons, service-worker scope, and `404.html` SPA fallback so navigation and email callbacks work below a GitHub repository path.

GitHub Pages serves the application files publicly. That does not make account data public: health screens require authentication and Postgres RLS is the authorization boundary. A private source repository also does not make a Pages site private. Use an access proxy or a different host if the application shell itself must be private.

GitHub Pages cannot set the response headers in `apps/web/public/_headers`; the HTML contains a CSP fallback. A commercial host should apply the full response headers in that file.

## Install on phones

- Android: open the deployed site in Chrome, choose **Install app** or use Grounded's **Install app** button.
- iPhone: open it in Safari, tap **Share**, choose **Add to Home Screen**, then **Add**.

Both people sign in with separate accounts. Connecting through the one-time partner code does not share anything until the account owner enables a category.

## Native stores

The Expo iOS/Android architecture and secure-storage boundary compile, but App Store and Play Store binaries require Apple/Google developer accounts, signing credentials, store privacy declarations, screenshots, device QA, and review. Those credentials and external approvals are not present in this repository. The installable PWA is the phone-ready release path today.
