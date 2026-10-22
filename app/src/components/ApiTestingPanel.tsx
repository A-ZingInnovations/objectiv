import type { ApiCollection, ApiRequest } from '../apiTesting';

type Props = {
  collections: ApiCollection[];
  activeRequestId: string | null;
  onOpenRequest: (requestId: string) => void;
  onNewRequest: (collectionId: string) => void;
  onNewCollection: () => void;
  onDeleteRequest: (collectionId: string, requestId: string) => void;
  onResetDefaults: () => void;
};

export default function ApiTestingPanel({
  collections,
  activeRequestId,
  onOpenRequest,
  onNewRequest,
  onNewCollection,
  onDeleteRequest,
  onResetDefaults,
}: Props) {
  return (
    <div className="api-testing-panel">
      <div className="side-bar-title">
        <span>API Testing</span>
        <div className="side-bar-actions">
          <button
            type="button"
            className="action"
            title="New collection"
            aria-label="New collection"
            onClick={onNewCollection}
          >
            <span className="codicon codicon-new-folder" aria-hidden />
          </button>
          <button
            type="button"
            className="action"
            title="New request"
            aria-label="New request"
            disabled={!collections.length}
            onClick={() => collections[0] && onNewRequest(collections[0].id)}
          >
            <span className="codicon codicon-add" aria-hidden />
          </button>
          <button
            type="button"
            className="action"
            title="Restore default Postman Echo collection"
            aria-label="Restore defaults"
            onClick={onResetDefaults}
          >
            <span className="codicon codicon-discard" aria-hidden />
          </button>
        </div>
      </div>
      <div className="side-bar-panel-fill api-testing-list-wrap">
        {collections.length === 0 ? (
          <p className="sidebar-section-empty">No collections — create one to start.</p>
        ) : (
          collections.map((col) => (
            <div key={col.id} className="api-collection">
              <div className="api-collection-head">
                <span className="codicon codicon-folder-opened" aria-hidden />
                <span className="api-collection-name">{col.name}</span>
                <button
                  type="button"
                  className="api-icon-btn"
                  title="New request"
                  aria-label="New request"
                  onClick={() => onNewRequest(col.id)}
                >
                  <span className="codicon codicon-add" aria-hidden />
                </button>
              </div>
              <ul className="sidebar-section-list api-request-list">
                {col.requests.map((req) => (
                  <li key={req.id}>
                    <RequestRow
                      request={req}
                      active={req.id === activeRequestId}
                      onOpen={() => onOpenRequest(req.id)}
                      onDelete={() => onDeleteRequest(col.id, req.id)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RequestRow({
  request,
  active,
  onOpen,
  onDelete,
}: {
  request: ApiRequest;
  active: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`sidebar-section-item api-request-row ${active ? 'active' : ''}`}>
      <button type="button" className="sidebar-section-item-main" onClick={onOpen} title={request.url}>
        <span className={`api-method api-method-${request.method.toLowerCase()}`} aria-hidden>
          {shortMethod(request.method)}
        </span>
        <span className="sidebar-section-item-label">{request.name}</span>
      </button>
      <button
        type="button"
        className="api-icon-btn api-request-delete"
        title="Delete"
        aria-label="Delete request"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <span className="codicon codicon-trash" aria-hidden />
      </button>
    </div>
  );
}

function shortMethod(method: string): string {
  if (method === 'DELETE') return 'DEL';
  if (method === 'OPTIONS') return 'OPT';
  if (method === 'PATCH') return 'PAT';
  return method;
}
