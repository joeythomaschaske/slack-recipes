export type Recipe = {
  id: number,
  name: string;
  link: string;
  description: string | undefined | null;
  imageLink: string | undefined | null;
  ingredients: string[];
  directions: string[];
};
