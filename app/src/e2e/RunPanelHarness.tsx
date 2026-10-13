/** Static Run panel chrome for Playwright (no Tauri workspace). */
export default function RunPanelHarness() {
  return (
    <div className="side-bar run-panel-e2e" data-testid="run-panel-harness">
      <div className="side-bar-title">RUN AND DEBUG</div>
      <div className="side-bar-placeholder">
        <p className="run-section-label">Python</p>
        <ul className="run-list">
          <li>
            <button type="button" className="run-list-btn">
              <span className="codicon codicon-beaker" aria-hidden />
              Python: pytest
            </button>
          </li>
          <li>
            <button type="button" className="run-list-btn">
              <span className="codicon codicon-beaker" aria-hidden />
              Python: pytest kay/kay/venv/lib/python3.9/site-packages/annotated_types/test_cases.py
            </button>
          </li>
        </ul>
        <p className="run-section-label">Launch</p>
        <ul className="run-list">
          <li>
            <div className="run-config-actions">
              <button type="button" className="run-list-btn">
                <span className="codicon codicon-play" aria-hidden /> Run Python: seed_db.py
              </button>
              <button type="button" className="run-list-btn">
                <span className="codicon codicon-debug-alt" aria-hidden /> Debug
              </button>
            </div>
            <span className="run-detail">python · launch · @0/kay/kay/seed_db.py</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
