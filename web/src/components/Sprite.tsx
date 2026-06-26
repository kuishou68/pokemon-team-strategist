import { useState } from 'react';

/** 走后端代理的图片，加载失败 fallback 精灵球占位 */
export function Sprite({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className={`pokeball-slot ${className ?? ''}`}
        role="img"
        aria-label={`${alt}（图片加载失败）`}
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
