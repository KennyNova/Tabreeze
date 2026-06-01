import rumiPortrait from "../assets/poets/rumi.svg";
import shakespearePortrait from "../assets/poets/shakespeare.svg";
import poePortrait from "../assets/poets/edgar-allan-poe.svg";
import dickinsonPortrait from "../assets/poets/emily-dickinson.svg";
import whitmanPortrait from "../assets/poets/walt-whitman.svg";
import nerudaPortrait from "../assets/poets/pablo-neruda.svg";

const poetPortraitByCategoryId: Record<string, string> = {
  rumi: rumiPortrait,
  shakespeare: shakespearePortrait,
  poe: poePortrait,
  dickinson: dickinsonPortrait,
  whitman: whitmanPortrait,
  neruda: nerudaPortrait,
};

export const POET_CATEGORY_IDS = Object.keys(poetPortraitByCategoryId);

const poetPortraitByAuthor: Record<string, string> = {
  rumi: rumiPortrait,
  williamshakespeare: shakespearePortrait,
  edgarallanpoe: poePortrait,
  emilydickinson: dickinsonPortrait,
  waltwhitman: whitmanPortrait,
  pabloneruda: nerudaPortrait,
};

function normalizeIdentity(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

export function getPoetPortraitForCategory(categoryId: string): string | null {
  return poetPortraitByCategoryId[categoryId] ?? null;
}

export function isPoetCategory(categoryId: string): boolean {
  return categoryId in poetPortraitByCategoryId;
}

const poetCategoryIdByAuthor: Record<string, string> = {
  rumi: "rumi",
  williamshakespeare: "shakespeare",
  edgarallanpoe: "poe",
  emilydickinson: "dickinson",
  waltwhitman: "whitman",
  pabloneruda: "neruda",
};

export function getPoetCategoryIdForAuthor(author: string): string | null {
  return poetCategoryIdByAuthor[normalizeIdentity(author)] ?? null;
}

export function getPoetPortraitForAuthor(author: string): string | null {
  return poetPortraitByAuthor[normalizeIdentity(author)] ?? null;
}
