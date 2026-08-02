# Grounded

A private, local-first personal health tracker focused on sustainable weight loss toward a configurable goal (90 kg by default).

## Run

Open `index.html` directly in a modern browser, or serve this folder locally:

```powershell
python -m http.server 4173
```

Then visit `http://localhost:4173`.

All data is stored in browser `localStorage`. Use Settings → Download backup regularly if the data matters to you.

## Install on a phone

After deployment to an HTTPS host, Android users can open the URL in Chrome and tap **Install app**. On iPhone, open the URL in Safari, tap **Share**, then **Add to Home Screen**. The installed app works offline.

The same link can be shared with Zoe. Data is separate on each device and is not sent to a server.

## Included

- Weight logs, trend charts, milestones, notes, and CSV export
- Daily mood, energy, sleep, and reflection check-ins
- Editable weekly habit tracker
- Configurable profile, starting weight, and goal weight
- Local JSON backup and restore
- Responsive desktop and mobile design

This is a wellbeing tracker, not a medical device. For personalised health or weight-loss advice, consult a qualified healthcare professional.
