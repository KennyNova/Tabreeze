import inspirationalArt from "../assets/quote-themes/inspirational.svg";
import darkArt from "../assets/quote-themes/dark.svg";
import famousArt from "../assets/quote-themes/famous.svg";
import stoicArt from "../assets/quote-themes/stoic.svg";
import philosophyArt from "../assets/quote-themes/philosophy.svg";
import literatureArt from "../assets/quote-themes/literature.svg";
import wittyArt from "../assets/quote-themes/witty.svg";
import loveArt from "../assets/quote-themes/love.svg";
import scienceArt from "../assets/quote-themes/science.svg";
import wisdomArt from "../assets/quote-themes/wisdom.svg";

const quoteThemeArtById: Record<string, string> = {
  inspirational: inspirationalArt,
  dark: darkArt,
  famous: famousArt,
  stoic: stoicArt,
  philosophy: philosophyArt,
  literature: literatureArt,
  witty: wittyArt,
  love: loveArt,
  science: scienceArt,
  wisdom: wisdomArt,
};

export function getQuoteThemeArt(categoryId: string): string | null {
  return quoteThemeArtById[categoryId] ?? null;
}
