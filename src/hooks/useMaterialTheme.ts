import { useEffect } from 'react';
import { useStore } from '../store';
import { themeFromSourceColor, argbFromHex, hexFromArgb, Hct, TonalPalette } from '@material/material-color-utilities';

export function useMaterialTheme() {
  const { theme, themeColor } = useStore();

  useEffect(() => {
    // Generate the theme based on the user's selected color
    const src = argbFromHex(themeColor);
    const mTheme = themeFromSourceColor(src);
    const scheme = theme === 'dark' ? mTheme.schemes.dark : mTheme.schemes.light;

    const root = document.documentElement;

    // Convert ARGB to CSS accepted hex
    const toHex = (argb: number) => hexFromArgb(argb);
    
    // Inject core material theme tokens
    // We can use these tokens directly for standard components if we want, but let's keep them handy.
    root.style.setProperty('--m-primary', toHex(scheme.primary));
    root.style.setProperty('--m-on-primary', toHex(scheme.onPrimary));
    root.style.setProperty('--m-primary-container', toHex(scheme.primaryContainer));
    root.style.setProperty('--m-on-primary-container', toHex(scheme.onPrimaryContainer));
    root.style.setProperty('--m-secondary', toHex(scheme.secondary));
    root.style.setProperty('--m-on-secondary', toHex(scheme.onSecondary));
    root.style.setProperty('--m-secondary-container', toHex(scheme.secondaryContainer));
    root.style.setProperty('--m-on-secondary-container', toHex(scheme.onSecondaryContainer));
    root.style.setProperty('--m-tertiary', toHex(scheme.tertiary));
    root.style.setProperty('--m-on-tertiary', toHex(scheme.onTertiary));
    root.style.setProperty('--m-tertiary-container', toHex(scheme.tertiaryContainer));
    root.style.setProperty('--m-on-tertiary-container', toHex(scheme.onTertiaryContainer));
    root.style.setProperty('--m-error', toHex(scheme.error));
    root.style.setProperty('--m-on-error', toHex(scheme.onError));
    root.style.setProperty('--m-background', toHex(scheme.background));
    root.style.setProperty('--m-on-background', toHex(scheme.onBackground));
    root.style.setProperty('--m-surface', toHex(scheme.surface));
    root.style.setProperty('--m-on-surface', toHex(scheme.onSurface));
    root.style.setProperty('--m-surface-variant', toHex(scheme.surfaceVariant));
    root.style.setProperty('--m-on-surface-variant', toHex(scheme.onSurfaceVariant));
    root.style.setProperty('--m-outline', toHex(scheme.outline));

    // To allow for N columns, generate harmonized palettes shifting hue by approx 30 degrees (12 variations)
    // For each variation, provide light/dark backgrounds and borders
    const baseHct = Hct.fromInt(src);
    
    for (let i = 0; i < 12; i++) {
      const hueShiftedHct = Hct.from(
        (baseHct.hue + i * (360 / 12)) % 360,
        baseHct.chroma,
        baseHct.tone
      );
      const palette = TonalPalette.fromInt(hueShiftedHct.toInt());
      
      const isDark = theme === 'dark';
      
      // Values typical for column backgrounds and text
      // In dark mode: darker backgrounds, lighter text.
      // We will define rgba variables too so we can use them with opacity in tailwind
      const bgTone = isDark ? 20 : 90;
      const textTone = isDark ? 90 : 10;
      const ringTone = isDark ? 40 : 80;
      const meshTone = isDark ? 30 : 80;
      
      // Store hex colors directly for the column
      root.style.setProperty(`--col-${i}-bg`, toHex(palette.tone(bgTone)));
      root.style.setProperty(`--col-${i}-bg-mesh`, toHex(palette.tone(meshTone)));
      root.style.setProperty(`--col-${i}-text`, toHex(palette.tone(textTone)));
      root.style.setProperty(`--col-${i}-ring`, toHex(palette.tone(ringTone)));
      
      // Hex to RGB to allow Tailwind opacity utilities
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 0, 0';
      };
      
      root.style.setProperty(`--col-${i}-rgb-bg`, hexToRgb(toHex(palette.tone(bgTone))));
      root.style.setProperty(`--col-${i}-rgb-mesh`, hexToRgb(toHex(palette.tone(meshTone))));
      root.style.setProperty(`--col-${i}-rgb-ring`, hexToRgb(toHex(palette.tone(ringTone))));
    }
  }, [theme, themeColor]);
}
