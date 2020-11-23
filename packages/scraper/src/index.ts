import axios, { AxiosResponse } from 'axios';
import { JSDOM } from 'jsdom';
import { Recipe } from './models/recipe';
import FirebaseFirestore from '@google-cloud/firestore';
import cliProgress from 'cli-progress';
import path from 'path';

const BASE_URL = 'https://www.epicurious.com';
const db = new FirebaseFirestore.Firestore({
  project: 'slack-recipes',
  keyFilename: path.normalize(path.join(__dirname, './firestorekey.json')),
  ignoreUndefinedProperties: true
});

const recipesRef = db.collection('recipes');

const getRecipes = async (): Promise<void> => {
  const url: URL = new URL(`${BASE_URL}/search?content=recipe&page=1&sort=newest`);
  const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  bar1.start(2038, 883);
  let recipeId = 15894;
  // 144
  for (let i = 883; i < 2039; i++) {
    url.searchParams.set('page', String(i));
    const page = await request(url.toString());
    const html = new JSDOM(page.data).window.document;
    const recipeArticles = html.getElementsByClassName('recipe-content-card');

    const bar2 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    bar2.start(recipeArticles.length, 0);
    for (const article of recipeArticles) {
      try {
        const link = article.children[1].getAttribute('href')!;
        const recipePage = await request(`${BASE_URL}${link}`);
        const html = new JSDOM(recipePage.data).window.document;
        const ingredients = Array.from(html.getElementsByClassName('ingredient')).map((ingredient) => {
          return (ingredient as HTMLElement).textContent!.trim();
        });
        const directions = Array.from(html.getElementsByClassName('preparation-step')).map((step) => {
          return (step as HTMLElement).textContent!.trim();
        });
        const recipe: Recipe = {
          id: recipeId,
          link: `${BASE_URL}${link}`,
          name: html.getElementsByTagName('h1')[0].textContent!,
          description: (html.getElementsByClassName('dek')[0] as HTMLElement)?.textContent,
          imageLink: html.getElementsByClassName('recipe-image-container')[0]?.getElementsByTagName('source')[0].getAttribute('srcset')!,
          ingredients,
          directions
        };
        await recipesRef.doc(`recipe-${recipeId}`).set(recipe);
      } catch (e) {
        console.log('error happened\n');
        console.log(e.message + '\n');
        console.log(BASE_URL + article.children[1].getAttribute('href') + '\n');
      }
      recipeId += 1;
      bar2.increment();
    }
    bar2.stop();
    bar1.increment();
  }
  bar1.stop();
};

const request = async (url: string): Promise<AxiosResponse> => {
  const page = await axios.get(url);
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(page);
    }, 1000);
  });
};

(async () => {
  await getRecipes();
})();
