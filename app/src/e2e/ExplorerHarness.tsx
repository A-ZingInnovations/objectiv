import FileTree from '../components/FileTree';

/** Static tree for Playwright — mirrors a noisy real workspace (md, sh, py, yaml, db). */
const MOCK_PATHS = [
  '@0/.gitignore',
  '@0/.gitlab-ci.yml',
  '@0/README.md',
  '@0/check-usb-drive.sh',
  '@0/kay/',
  '@0/kay/.env.example',
  '@0/kay/DEMO.md',
  '@0/kay/Procfile',
  '@0/kay/kay/',
  '@0/kay/kay/manage.py',
  '@0/kay/kay/requirements.txt',
  '@0/kay/kay/db.sqlite3',
];

const noop = () => {};

export default function ExplorerHarness() {
  return (
    <div className="side-bar explorer-e2e" data-testid="explorer-harness">
      <FileTree
        diskMode
        busy={false}
        filePaths={MOCK_PATHS}
        workspaceRoots={['/tmp/objectiv-e2e-workspace']}
        activeRootIndex={0}
        activePath="@0/kay/DEMO.md"
        onOpenFile={noop}
        onNewFile={noop}
        onOpenFolder={noop}
        onAddFolder={noop}
        onSelectRoot={noop}
        onRefresh={noop}
        isRootTrusted={() => true}
      />
    </div>
  );
}
