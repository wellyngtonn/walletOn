$ErrorActionPreference = "Stop"

# Use the Firebase CLI OAuth session instead of any legacy FIREBASE_TOKEN.
$env:FIREBASE_TOKEN = $null

firebase deploy --only firestore:indexes --project wallet-on-c0b05
