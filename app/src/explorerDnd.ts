import { encodeDiskPath, parseDiskPath } from './workspaceDisk';

export function explorerPathIsDir(encodedPath: string, filePaths: string[]): boolean {
  const dirMarker = `${encodedPath.replace(/\/+$/, '')}/`;
  return filePaths.some((p) => p === dirMarker || p.startsWith(dirMarker));
}

/** Block dropping a folder into itself or a descendant. */
export function invalidExplorerDrop(
  sourceEncoded: string,
  destDirEncoded: string,
  sourceIsDir: boolean,
): boolean {
  const src = parseDiskPath(sourceEncoded);
  const dest = parseDiskPath(destDirEncoded);
  if (!src || !dest) return true;
  if (!src.relPath.replace(/\/+$/, '')) return true;
  if (sourceEncoded.replace(/\/+$/, '') === destDirEncoded.replace(/\/+$/, '')) return true;
  if (!sourceIsDir) return false;
  const srcDir = encodeDiskPath(src.rootIndex, `${src.relPath.replace(/\/+$/, '')}/`);
  const destNorm = destDirEncoded.endsWith('/') ? destDirEncoded : `${destDirEncoded}/`;
  return destNorm.startsWith(srcDir);
}
