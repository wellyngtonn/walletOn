$ErrorActionPreference = "Stop"

# Use the Firebase CLI OAuth session instead of any legacy FIREBASE_TOKEN.
$env:FIREBASE_TOKEN = $null

# Deploy every resource declared in firebase.json:
# Hosting (including its build hook), Firestore rules/indexes, and Storage rules.
firebase deploy --project wallet-on-c0b05
