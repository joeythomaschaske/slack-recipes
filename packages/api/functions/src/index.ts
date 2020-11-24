import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { WebClient } from '@slack/web-api';
import { Recipe } from './types/recipe';

const db = admin.initializeApp().firestore();
const client = new WebClient(functions.config().slack['bot-token']);

// TODO use pub/sub to respon async and return 200 right away
export const menu = functions.https.onRequest(async (request, response) => {
  if (!verifySignature(request)) {
    response.status(401).send('gtfo');
  }
  
  const channelId = request.body.channel_id;
  const id = Math.floor(Math.random() * 15893);
  const ref = (await db.collection('recipes').where('id', '<=', id).orderBy('id', 'desc').limit(1).get()).docs;
  const recipe: Recipe = ref[0].data() as unknown as Recipe;

  const recipeBlocks = createMenu(recipe);

  await client.chat.postMessage({
    text: 'Here is your suggestion!',
    blocks: recipeBlocks.blocks,
    channel: channelId,
  });

  response.status(200).send();
});

// TODO use pub/sub to respon async and return 200 right away
// TODO keep track of interactions by storing them in th DB instead of trying to read the blocks to determine what has happened
export const interaction = functions.https.onRequest(async (request, response) => {
  if (!verifySignature(request)) {
    response.status(401).send('gtfo');
  }

  const payload = JSON.parse(request.body.payload);
  const action = payload.actions[0].value;
  const ts = payload.message.ts;
  const channel = payload.channel.id;

  if (action === 'yes') {
    const blocks = payload.message.blocks;
    const hasContext = blocks[blocks.length - 1].type === 'context';
    let addContext = false;
    let removeButtons = false;
    if (hasContext) {
      const contextBlock = blocks[blocks.length - 1];
      if (!contextBlock.elements[0].text.includes(payload.user.name)) {
        removeButtons = true;
      }
    } else {
      addContext = true;
    }

    if (addContext) {
      blocks.push(makeContext(payload.user.name, payload.user.id));
    } else if (removeButtons) {
      const indexToRemove = blocks.findIndex((block: any) => {
        return block.type === 'actions';
      })
      blocks.splice(indexToRemove, 1);
      let context = blocks[blocks.length - 1].elements[0].text;
      context = context.split(' ')[0];
      context += ` and ${payload.user.name} voted yes`;
      blocks[blocks.length - 1].elements[0].text = context
    }
    await client.chat.update({
      channel,
      ts,
      text: 'Here is your suggestion!',
      blocks: blocks,
    });
  } else if (action === 'no') {
    const id = Math.floor(Math.random() * 15893);
    const ref = (await db.collection('recipes').where('id', '<=', id).orderBy('id', 'desc').limit(1).get()).docs;
    const recipe: Recipe = ref[0].data() as unknown as Recipe;

    const recipeBlocks = createMenu(recipe);

    await client.chat.update({
      channel,
      ts,
      text: 'Here is your suggestion!',
      blocks: recipeBlocks.blocks,
    });
  }

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
        "value": "yes",
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
        "value": "no",
        "action_id": "no",
      },
    ],
  }
}

const makeContext = (name: string, userId: string) => {
  return {
    "type": "context",
    "elements": [
      {
        "type": "plain_text",
        "text": `${name} voted yes`,
      },
    ],
  };
}
