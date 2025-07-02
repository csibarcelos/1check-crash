import React from 'react';

export const AppLogoIcon = (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
  return (
    <img
      src="https://i.imgur.com/kdm9n4P.png"
      alt={props.alt || "1Checkout Logo"}
      className={`object-contain ${props.className || 'h-10 w-auto'}`}
      {...props}
    />
  );
};