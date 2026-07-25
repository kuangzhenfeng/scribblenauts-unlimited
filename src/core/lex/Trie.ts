/**
 * Trie —— 前缀树，用于自动补全与前缀查找。
 *
 * 中文字符级 Trie（key 为单个字符）；英文用小写字母级。
 * 同时记录每个节点是否为完整词条终止点，及其 entryId。
 */

export interface TrieNode {
  children: Map<string, TrieNode>;
  /** 若此节点为某词条终止点，记录其 id */
  terminalId?: string;
}

export function createTrieNode(): TrieNode {
  return { children: new Map() };
}

export class Trie {
  readonly root: TrieNode = createTrieNode();

  /** 插入一个词条文本 → entryId */
  insert(text: string, entryId: string): void {
    let node = this.root;
    for (const ch of text) {
      let next = node.children.get(ch);
      if (!next) {
        next = createTrieNode();
        node.children.set(ch, next);
      }
      node = next;
    }
    node.terminalId = entryId;
  }

  /** 精确查找 */
  exact(text: string): string | undefined {
    let node = this.root;
    for (const ch of text) {
      const next = node.children.get(ch);
      if (!next) return undefined;
      node = next;
    }
    return node.terminalId;
  }

  /** 前缀是否存在（返回前缀终点节点） */
  private findPrefix(text: string): TrieNode | undefined {
    let node = this.root;
    for (const ch of text) {
      const next = node.children.get(ch);
      if (!next) return undefined;
      node = next;
    }
    return node;
  }

  /** 收集此前缀下的所有终止词条（含前缀本身），最多 limit 个 */
  collect(prefix: string, limit: number): { text: string; id: string }[] {
    const start = this.findPrefix(prefix);
    if (!start) return [];
    const out: { text: string; id: string }[] = [];
    const walk = (node: TrieNode, text: string): boolean => {
      if (out.length >= limit) return false;
      if (node.terminalId) out.push({ text, id: node.terminalId });
      for (const [ch, child] of node.children) {
        if (!walk(child, text + ch)) return false;
      }
      return true;
    };
    walk(start, prefix);
    return out;
  }
}
