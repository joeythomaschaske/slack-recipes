# slack-recipes

Sends a random recipe to slack

## Installation

download the [firebase-cli](https://firebase.google.com/docs/cli) and authenticate

download the [gcloud-cli](https://cloud.google.com/sdk/docs/install) and authenticate

run `npm install` in 

- root
- packages/api/functions
- packages/scraper


Create a [slack app](https://api.slack.com/apps) with slash command and `chat:write` and `chat:write.public` scopes

Create a json [service account](https://console.cloud.google.com/iam-admin/serviceaccounts) key for firestore access. give it the `firebase-adminsdk` permission. Save the file to `packages/scraper/src` and name it as `firestorekey.json`

### set slack config vars with the firebase cli

```
firebase functions:config:set slack.client-secret="secret" slack.client-id="THE CLIENT ID" ...
```

Set all configs and run `firebase functions:config:get` to confirm they are set

```
{
  "slack": {
    "client-secret": "--secret--",
    "client-id": "--client-id--",
    "bot-token": "--xoxb-bot-token--",
    "verification-token": "--verification-token--",
    "signing-secret": "--signing-secret--"
  }
}
```

### deploy functions
run

```
cd packages/api/functions && firebase deploy
```

### deploy the free vm instance

```
cd packages/scraper && npm run deploy
```

### upload scraper to vm

build the project

```
cd packages/scraper && npm run build && rm -rf node_modules && ..
```

deploy to vm

```
gcloud compute scp --recurse scraper vm:~
```

SSH into the vm from the vm instance in the google cloud console

Set ownership and install modules and run

```
sudo chown -R $USER scraper
cd scraper && npm install
node dist/scraper/index.js
```


