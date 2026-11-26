export type XmlTreeNode = {
  name: string;
  children: XmlTreeNode[];
};

export type XmlStructureInfo = {
  valid: boolean;
  error?: string;
  root?: string;
  documentElement?: string;
  elementCount: number;
  attributeCount: number;
  maxDepth: number;
  tree: XmlTreeNode[];
  /** First-level element names under root. */
  childTags: string[];
};

const MAX_TREE_NODES = 400;

function walkElement(el: Element, depth: number): { node: XmlTreeNode; elements: number; attrs: number; maxDepth: number } {
  let elements = 1;
  let attrs = el.attributes.length;
  let maxDepth = depth;
  const children: XmlTreeNode[] = [];
  for (const child of el.children) {
    const sub = walkElement(child, depth + 1);
    children.push(sub.node);
    elements += sub.elements;
    attrs += sub.attrs;
    maxDepth = Math.max(maxDepth, sub.maxDepth);
    if (elements >= MAX_TREE_NODES) break;
  }
  return {
    node: { name: el.tagName, children },
    elements,
    attrs,
    maxDepth,
  };
}

export function analyzeXmlDocument(text: string): XmlStructureInfo {
  const empty: XmlStructureInfo = {
    valid: false,
    elementCount: 0,
    attributeCount: 0,
    maxDepth: 0,
    tree: [],
    childTags: [],
  };
  const trimmed = text.trim();
  if (!trimmed) {
    return { ...empty, error: 'Empty document' };
  }
  try {
    const doc = new DOMParser().parseFromString(trimmed, 'application/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      const msg = parseError.textContent?.trim() || 'XML parse error';
      return { ...empty, error: msg.slice(0, 280) };
    }
    const root = doc.documentElement;
    if (!root) return { ...empty, error: 'No document element' };
    const walked = walkElement(root, 1);
    const childTags = [...root.children].map((c) => c.tagName);
    return {
      valid: true,
      root: root.tagName,
      documentElement: root.tagName,
      elementCount: walked.elements,
      attributeCount: walked.attrs,
      maxDepth: walked.maxDepth,
      tree: [walked.node],
      childTags: [...new Set(childTags)].slice(0, 48),
    };
  } catch (e) {
    return {
      ...empty,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export function isXmlPath(path: string): boolean {
  return /\.(xml|xsd|xsl|xslt|svg|plist|rss|atom|wsdl|csproj|props|targets)$/i.test(path);
}