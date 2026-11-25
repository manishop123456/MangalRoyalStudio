'use client';

import React, { useEffect, useState } from 'react';
import { PRODUCT_IMAGE_PLACEHOLDER } from '../lib/storefront-data';

export interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  hideOnError?: boolean;
}

export function SafeImage({
  src,
  srcSet,
  sizes,
  fallbackSrc = PRODUCT_IMAGE_PLACEHOLDER,
  hideOnError = false,
  onError,
  onLoad,
  alt,
  ...rest
}: SafeImageProps) {
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setErrored(false);
  }, [src]);

  const effectiveSrc = !src || errored ? fallbackSrc : src;
  const effectiveSrcSet = !src || errored ? undefined : srcSet;
  const effectiveSizes = !src || errored ? undefined : sizes;

  if (hideOnError && errored) {
    return null;
  }

  return (
    <img
      {...rest}
      src={effectiveSrc}
      srcSet={effectiveSrcSet}
      sizes={effectiveSizes}
      alt={alt ?? ''}
      onError={(e) => {
        if (!errored) {
          setErrored(true);
        }
        onError?.(e);
      }}
      onLoad={(e) => {
        const img = e.currentTarget;
        if (!errored && (img.naturalWidth === 0 || img.naturalHeight === 0)) {
          setErrored(true);
        }
        onLoad?.(e);
      }}
    />
  );
}
