import { siClaude, siGoogle, siPerplexity } from "simple-icons";

interface SearchSourceLogoProps {
  sourceId?: string;
  className?: string;
}

const OPENAI_SYMBOL_SVG_URL =
  "https://upload.wikimedia.org/wikipedia/commons/6/66/OpenAI_logo_2025_%28symbol%29.svg";
const BING_SYMBOL_SVG_URL =
  "https://upload.wikimedia.org/wikipedia/commons/0/07/Bing_favicon.svg";

function FallbackSearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M21 21l-4.3-4.3m1.3-4.7a6 6 0 11-12 0 6 6 0 0112 0z"
      />
    </svg>
  );
}

function SimpleIcon({
  path,
  className,
}: {
  path: string;
  className?: string;
}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d={path} />
    </svg>
  );
}

function RemoteIcon({ src, className }: { src: string; className?: string }) {
  return <img src={src} alt="" className={className} draggable={false} />;
}

export default function SearchSourceLogo({ sourceId, className }: SearchSourceLogoProps) {
  if (sourceId === "google") {
    return <SimpleIcon path={siGoogle.path} className={className} />;
  }
  if (sourceId === "claude") {
    return <SimpleIcon path={siClaude.path} className={className} />;
  }
  if (sourceId === "perplexity") {
    return <SimpleIcon path={siPerplexity.path} className={className} />;
  }
  if (sourceId === "chatgpt") {
    return <RemoteIcon src={OPENAI_SYMBOL_SVG_URL} className={className} />;
  }
  if (sourceId === "bing") {
    return <RemoteIcon src={BING_SYMBOL_SVG_URL} className={className} />;
  }
  return <FallbackSearchIcon className={className} />;
}
