set -e

pathToConfig=$(dirname "$0")"/../gcloud-config.json"

gcloud deployment-manager deployments create "slack-recipe-stack" --config=$pathToConfig