import themeJson from './vs-seti-icon-theme.json';
import { fileBaseName } from '../fileViewers';

type IconDef = {
  fontCharacter: string;
  fontColor?: string;
  fontSize?: string;
};

type SetiThemeFile = {
  file: string;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  iconDefinitions: Record<string, IconDef>;
  light?: {
    file?: string;
    fileExtensions?: Record<string, string>;
    fileNames?: Record<string, string>;
  };
};

const theme = themeJson as SetiThemeFile;

/** VS Code Seti `fontCharacter` (e.g. `\E001`) → glyph. */
export function setiFontCharacterToGlyph(fontCharacter: string): string {
  if (!fontCharacter) return '';
  if (fontCharacter.startsWith('\\')) {
    const hex = fontCharacter.slice(1);
    const code = parseInt(hex, 16);
    if (Number.isFinite(code)) return String.fromCodePoint(code);
  }
  return fontCharacter;
}

function mapsForTheme(light: boolean) {
  if (!light || !theme.light) {
    return {
      fileDefault: theme.file,
      fileExtensions: theme.fileExtensions,
      fileNames: theme.fileNames,
    };
  }
  return {
    fileDefault: theme.light.file ?? theme.file,
    fileExtensions: { ...theme.fileExtensions, ...theme.light.fileExtensions },
    fileNames: { ...theme.fileNames, ...theme.light.fileNames },
  };
}

function extensionDefId(extMap: Record<string, string>, fileName: string): string | undefined {
  const lower = fileName.toLowerCase();
  let from = lower.indexOf('.');
  if (from <= 0) return undefined;
  from += 1;
  while (from < lower.length) {
    const ext = lower.slice(from);
    const hit = extMap[ext];
    if (hit) return hit;
    const nextDot = lower.indexOf('.', from);
    if (nextDot < 0) break;
    from = nextDot + 1;
  }
  return undefined;
}

/** Resolve Seti definition id for a workspace-relative file path (same rules as VS Code Seti). */
export function resolveSetiDefinitionId(relPath: string, light: boolean): string {
  const maps = mapsForTheme(light);
  const base = fileBaseName(relPath);
  const nameKey = base.toLowerCase();

  const byName = maps.fileNames[nameKey];
  if (byName) return byName;

  const byExt = extensionDefId(maps.fileExtensions, base);
  if (byExt) return byExt;

  return maps.fileDefault;
}

export function resolveSetiFileIcon(
  relPath: string,
  light: boolean,
): { glyph: string; color?: string; fontSize?: string } {
  const defId = resolveSetiDefinitionId(relPath, light);
  const def = theme.iconDefinitions[defId] ?? theme.iconDefinitions[theme.file];
  if (!def) {
    return { glyph: '' };
  }
  return {
    glyph: setiFontCharacterToGlyph(def.fontCharacter),
    color: def.fontColor,
    fontSize: def.fontSize,
  };
}
