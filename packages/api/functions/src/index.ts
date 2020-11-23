import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { WebClient } from '@slack/web-api';
import { Recipe } from './types/recipe';

const db = admin.initializeApp().firestore();

export const menu = functions.https.onRequest(async (request, response) => {
  if (!verifySignature(request)) {
    response.status(401).send('gtfo');
  }
  
  const channelId = request.body.channel_id;
  const client = new WebClient(functions.config().slack['bot-token']);
  const id = Math.floor(Math.random() * 15893);
  const ref = await (await db.collection('recipes').where('id', '<=', id).orderBy('id', 'desc').limit(1).get()).docs;
  const recipe: Recipe = ref[0].data() as unknown as Recipe;

  const recipeBlocks = createMenu(recipe);

  await client.chat.postMessage({
    text: 'Here is your suggestion!',
    blocks: recipeBlocks.blocks,
    channel: channelId,
  });

  response.status(200).send();
});

const verifySignature = (request: functions.https.Request): boolean => {
  const timestamp: string  = request.headers['x-slack-request-timestamp'] as string;
  const signature: string = request.headers['x-slack-signature'] as string;
  const body = request.rawBody;

  const base = `v0:${timestamp}:${body}`;

  const hmac = 'v0=' + crypto.createHmac('sha256', functions.config().slack['signing-secret']).update(base, 'utf8').digest('hex');
  return hmac === signature;
}

const createMenu = (recipe: Recipe) => {
  const menuBlocks: Record<string, any> = {
    blocks: [],
  }
  menuBlocks.blocks.push(makeTitle(recipe.name));
  menuBlocks.blocks.push(makeDivider());
  menuBlocks.blocks.push(makeDescription(recipe.description, recipe.imageLink, recipe.name));
  menuBlocks.blocks.push(makeViewButton(recipe.link));
  menuBlocks.blocks.push(makeDivider());
  makeIngredients(recipe.ingredients).forEach((section) => {
    menuBlocks.blocks.push(section);
  })
  menuBlocks.blocks.push(makeActions());
  return menuBlocks;
}

const makeTitle = (title: string) => {
  return {
    "type": "header",
    "text": {
      "type": "plain_text",
      "text": title,
    },
  };
};

const makeDivider = () => {
  return {
    "type": "divider",
  };
};

const makeDescription = (description: string | undefined | null, image: string | undefined | null, title: string) => {
  const section: Record<string, unknown> = {
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": description || title,
    },
  };
  if (image) {
    section.accessory = {
      "type": "image",
      "image_url": image,
      "alt_text": "food",
    };
  }
  return section;
}

const makeViewButton = (link: string) => {
  return {
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": "View this recipe",
    },
    "accessory": {
      "type": "button",
      "text": {
        "type": "plain_text",
        "text": "View",
        "emoji": true,
      },
      "value": "view",
      "url": link,
      "action_id": "button-action",
    },
  }
}

const makeIngredients = (ingredients: string[]) => {
  const indredientsInBatchesOf10 = ingredients.reduce((resultArray: string[][], item, index) => { 
    const chunkIndex = Math.floor(index/10)
  
    if(!resultArray[chunkIndex]) {
      resultArray[chunkIndex] = []
    }
  
    resultArray[chunkIndex].push(item)
  
    return resultArray
  }, [])
  const sections = indredientsInBatchesOf10.map((list) => {
    const block: Record<string, unknown> = {
      "type": "section",
    }
    block.fields = list.map((ingredient) => {
      return {
        "type": "plain_text",
        "text": ingredient,
        "emoji": true,
      };
    });
    return block;
  });
  return sections;
};

const makeActions = () => {
  return {
    "type": "actions",
    "elements": [
      {
        "type": "button",
        "text": {
          "type": "plain_text",
          "text": "Yes",
          "emoji": true,
        },
        "style": "primary",
        "value": "true",
        "action_id": "yes",
      },
      {
        "type": "button",
        "text": {
          "type": "plain_text",
          "text": "No",
          "emoji": true,
        },
        "style": "danger",
        "value": "false",
        "action_id": "no",
      },
    ],
  }
}

// const makeContext = () => {
//   //todo mark who voted
// }
