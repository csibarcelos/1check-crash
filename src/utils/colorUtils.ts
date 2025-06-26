// src/utils/colorUtils.ts

/**
 * Converts a HEX color string to an RGBA object.
 * Supports #RGB, #RRGGBB formats. Alpha is set to the provided value or defaults to 1.
 */
export function hexToRgba(hex: string, alpha: number = 1): { r: number; g: number; b: number; a: number } {
  let r = 0, g = 0, b = 0;
  const h = hex.replace("#", "");

  if (h.length === 3) { // #RGB
    r = parseInt(h[0] + h[0], 16);
    g = parseInt(h[1] + h[1], 16);
    b = parseInt(h[2] + h[2], 16);
  } else if (h.length === 6) { // #RRGGBB
    r = parseInt(h.substring(0, 2), 16);
    g = parseInt(h.substring(2, 4), 16);
    b = parseInt(h.substring(4, 6), 16);
  } else {
    // console.warn(`Invalid hex string for RGB conversion: ${hex}. Defaulting to black.`);
    return { r: 0, g: 0, b: 0, a: alpha };
  }
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    // console.warn(`Failed to parse RGB from hex: ${hex}. Defaulting to black.`);
    return { r: 0, g: 0, b: 0, a: alpha };
  }
  return { r, g, b, a: alpha };
}

/**
 * Converts RGB color components to a HEX string.
 */
export function rgbaToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => ('0' + Math.round(c).toString(16)).slice(-2);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}


/**
 * Calculates the effective background color when a semi-transparent foreground color
 * is overlaid on an opaque base background color.
 * @param foregroundColorHexWithPossibleAlpha Foreground color, e.g., "#RRGGBBAA", "#RGBA", "#RRGGBB", "#RGB".
 * @param baseBackgroundColorHex Opaque base background color, e.g., "#RRGGBB".
 * @returns The resulting opaque color in HEX format (e.g., "#RRGGBB").
 */
export function calculateEffectiveBg(foregroundColorHexWithPossibleAlpha: string, baseBackgroundColorHex: string): string {
  let fgHex = foregroundColorHexWithPossibleAlpha.replace("#", "").trim();
  let fgAlpha = 1;

  if (fgHex.length === 8) { // #RRGGBBAA
    fgAlpha = parseInt(fgHex.substring(6, 8), 16) / 255;
    fgHex = fgHex.substring(0, 6);
  } else if (fgHex.length === 4) { // #RGBA
     fgAlpha = parseInt(fgHex[3] + fgHex[3], 16) / 255;
     fgHex = fgHex[0] + fgHex[0] + fgHex[1] + fgHex[1] + fgHex[2] + fgHex[2];
  } else if (fgHex.length === 3) { // #RGB
    fgHex = fgHex[0] + fgHex[0] + fgHex[1] + fgHex[1] + fgHex[2] + fgHex[2];
  } else if (fgHex.length !== 6) { // Assumed #RRGGBB, or invalid
    // console.warn(`Invalid foreground hex for effective background calculation: ${foregroundColorHexWithPossibleAlpha}. Assuming opaque.`);
    // If it's just #RRGGBB or invalid, treat as opaque on its own for safety, or return base if fg is totally invalid
    if (fgHex.length !== 6) return baseBackgroundColorHex;
  }

  const fgRgba = hexToRgba("#" + fgHex, fgAlpha); // Pass alpha for foreground
  const bgRgba = hexToRgba(baseBackgroundColorHex, 1); // Base background is always opaque

  // Alpha compositing formula: C_out = C_fg * α_fg + C_bg * α_bg * (1 - α_fg)
  // Since α_bg (base background alpha) is 1: C_out = C_fg * α_fg + C_bg * (1 - α_fg)
  const outR = fgRgba.a * fgRgba.r + (1 - fgRgba.a) * bgRgba.r;
  const outG = fgRgba.a * fgRgba.g + (1 - fgRgba.a) * bgRgba.g;
  const outB = fgRgba.a * fgRgba.b + (1 - fgRgba.a) * bgRgba.b;

  return rgbaToHex(outR, outG, outB);
}


/**
 * Calculates the optimal text color (light or dark) for a given background color
 * based on luminance to ensure good contrast.
 * Uses the sRGB luminance formula.
 *
 * @param backgroundColor The background color in HEX format (e.g., "#RRGGBB" or "#RGB").
 * @param options Optional configuration for light color, dark color, and luminance threshold.
 * @returns The recommended text color (e.g., '#FFFFFF' or '#000000').
 */
export function getOptimalTextColor(
  backgroundColor: string,
  options?: {
    lightColor?: string;
    darkColor?: string;
    threshold?: number;
  }
): string {
  const {
    lightColor = "#FFFFFF", // Default light text color
    darkColor = "#1F2937",  // Default dark text color (Tailwind gray-800)
    threshold = 0.5, 
  } = options || {};

  if (!backgroundColor || !/^#([0-9A-F]{3,4}|[0-9A-F]{6}|[0-9A-F]{8})$/i.test(backgroundColor.trim())) {
    // Fallback for invalid background color: assume light page, use dark text.
    return darkColor;
  }

  let hex = backgroundColor.trim().replace("#", "");

  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  if (hex.length === 4) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]; // #RGBA to #RRGGBB
  if (hex.length === 8) hex = hex.substring(0, 6); // #RRGGBBAA to #RRGGBB
  
  if (hex.length !== 6) return darkColor;
  
  const r_int = parseInt(hex.substring(0, 2), 16);
  const g_int = parseInt(hex.substring(2, 4), 16);
  const b_int = parseInt(hex.substring(4, 6), 16);

  if (isNaN(r_int) || isNaN(g_int) || isNaN(b_int)) return darkColor;

  const getSRGBValue = (c: number): number => {
    const srgb = c / 255.0;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };

  const lumR = getSRGBValue(r_int);
  const lumG = getSRGBValue(g_int);
  const lumB = getSRGBValue(b_int);

  const luminance = 0.2126 * lumR + 0.7152 * lumG + 0.0722 * lumB;

  return luminance > threshold ? darkColor : lightColor;
}