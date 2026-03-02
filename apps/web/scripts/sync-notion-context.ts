import fs from "node:fs/promises";
import path from "node:path";
import { config as dotenvConfig } from "dotenv";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function loadEnvForScript(): void {
  const cwd = process.cwd();
  const candidates = [path.resolve(cwd, ".env.local"), path.resolve(cwd, ".env")];

  // If launched from monorepo root, also try apps/web/.env files.
  const normalizedCwd = cwd.replace(/\\/g, "/").toLowerCase();
  if (!normalizedCwd.endsWith("/apps/web")) {
    candidates.push(path.resolve(cwd, "apps/web/.env.local"));
    candidates.push(path.resolve(cwd, "apps/web/.env"));
  }

  for (const file of candidates) {
    dotenvConfig({ path: file, override: false });
  }
}

loadEnvForScript();

type NotionRichText = {
  plain_text?: string;
  href?: string | null;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    code?: boolean;
  };
};

type NotionProperty = {
  type?: string;
  [key: string]: unknown;
};

type NotionPage = {
  id: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  archived?: boolean;
  in_trash?: boolean;
  properties: Record<string, NotionProperty>;
};

type NotionBlock = {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
};

type NotionListResponse<T> = {
  results: T[];
  has_more: boolean;
  next_cursor: string | null;
};

function parseArg(name: string): string | null {
  const index = process.argv.findIndex((value) => value === name);
  if (index === -1 || index + 1 >= process.argv.length) return null;
  return process.argv[index + 1];
}

function normalizePageSize(raw: string | null): number {
  const parsed = Number(raw || "50");
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asRichTextArray(value: unknown): NotionRichText[] {
  if (!Array.isArray(value)) return [];
  return value as NotionRichText[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function yamlQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function notionRequest<T>(
  token: string,
  endpoint: string,
  init: RequestInit = {},
  attempt = 0
): Promise<T> {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };

  const response = await fetch(`${NOTION_API_BASE}${endpoint}`, {
    ...init,
    headers,
  });

  if (response.status === 429 && attempt < 4) {
    const retryAfter = Number(response.headers.get("retry-after") || "1");
    await sleep(Math.max(1, retryAfter) * 1000);
    return notionRequest<T>(token, endpoint, init, attempt + 1);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Notion API ${response.status} on ${endpoint}: ${body.slice(0, 400)}`);
  }

  return (await response.json()) as T;
}

async function queryDatabasePages(
  token: string,
  databaseId: string,
  pageSize: number
): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let nextCursor: string | null = null;

  do {
    const payload: Record<string, unknown> = {
      page_size: pageSize,
      ...(nextCursor ? { start_cursor: nextCursor } : {}),
    };

    const result = await notionRequest<NotionListResponse<NotionPage>>(
      token,
      `/databases/${encodeURIComponent(databaseId)}/query`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    pages.push(...result.results);
    nextCursor = result.has_more ? result.next_cursor : null;
  } while (nextCursor);

  return pages.filter((page) => !page.archived && !page.in_trash);
}

async function fetchBlockChildren(
  token: string,
  blockId: string,
  pageSize: number
): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let nextCursor: string | null = null;

  do {
    const queryParams: Record<string, string> = {
      page_size: String(pageSize),
    };
    if (nextCursor) {
      queryParams.start_cursor = nextCursor;
    }
    const query = new URLSearchParams(queryParams);
    const result: NotionListResponse<NotionBlock> = await notionRequest<
      NotionListResponse<NotionBlock>
    >(
      token,
      `/blocks/${encodeURIComponent(blockId)}/children?${query.toString()}`,
      { method: "GET" }
    );
    blocks.push(...result.results);
    nextCursor = result.has_more ? result.next_cursor : null;
  } while (nextCursor);

  return blocks;
}

function richTextToMarkdown(richText: NotionRichText[]): string {
  return richText
    .map((item) => {
      let text = item.plain_text || "";
      if (!text) return "";

      if (item.href) text = `[${text}](${item.href})`;
      if (item.annotations?.code) text = `\`${text}\``;
      if (item.annotations?.bold) text = `**${text}**`;
      if (item.annotations?.italic) text = `*${text}*`;
      if (item.annotations?.strikethrough) text = `~~${text}~~`;
      return text;
    })
    .join("");
}

function propertyToString(property: NotionProperty): string {
  const type = asString(property.type) || "";
  const typedValue = property[type];

  if (type === "title" || type === "rich_text") {
    return richTextToMarkdown(asRichTextArray(typedValue));
  }
  if (type === "status" || type === "select") {
    const record = asRecord(typedValue);
    return asString(record?.name) || "";
  }
  if (type === "multi_select") {
    if (!Array.isArray(typedValue)) return "";
    return typedValue
      .map((item) => asString(asRecord(item)?.name) || "")
      .filter(Boolean)
      .join(", ");
  }
  if (type === "checkbox") {
    return String(Boolean(typedValue));
  }
  if (type === "number") {
    return typeof typedValue === "number" ? String(typedValue) : "";
  }
  if (type === "date") {
    const record = asRecord(typedValue);
    const start = asString(record?.start) || "";
    const end = asString(record?.end) || "";
    return end ? `${start} -> ${end}` : start;
  }
  if (type === "url" || type === "email" || type === "phone_number") {
    return asString(typedValue) || "";
  }
  if (type === "people" || type === "relation") {
    if (!Array.isArray(typedValue)) return "";
    return String(typedValue.length);
  }
  return "";
}

function summarizeProperties(properties: Record<string, NotionProperty>): Record<string, string> {
  const summary: Record<string, string> = {};

  for (const [name, property] of Object.entries(properties)) {
    const value = propertyToString(property);
    if (value) summary[name] = value;
  }

  return summary;
}

function getPageTitle(properties: Record<string, NotionProperty>): string {
  for (const property of Object.values(properties)) {
    if (property.type === "title") {
      const raw = property.title;
      return richTextToMarkdown(asRichTextArray(raw)).trim();
    }
  }
  return "Untitled";
}

async function renderBlock(
  token: string,
  block: NotionBlock,
  pageSize: number,
  depth = 0
): Promise<string[]> {
  const lines: string[] = [];
  const indent = " ".repeat(Math.max(0, depth) * 2);
  const payload = asRecord(block[block.type]) || {};
  const text = richTextToMarkdown(asRichTextArray(payload.rich_text)).trim();

  switch (block.type) {
    case "paragraph":
      lines.push(text || "");
      break;
    case "heading_1":
      lines.push(`# ${text || "Untitled"}`);
      break;
    case "heading_2":
      lines.push(`## ${text || "Untitled"}`);
      break;
    case "heading_3":
      lines.push(`### ${text || "Untitled"}`);
      break;
    case "bulleted_list_item":
      lines.push(`${indent}- ${text}`);
      break;
    case "numbered_list_item":
      lines.push(`${indent}1. ${text}`);
      break;
    case "to_do":
      lines.push(`${indent}- [${payload.checked ? "x" : " "}] ${text}`);
      break;
    case "quote":
      lines.push(`${indent}> ${text}`);
      break;
    case "code": {
      const language = asString(payload.language) || "";
      lines.push(`${indent}\`\`\`${language}`);
      lines.push(text);
      lines.push(`${indent}\`\`\``);
      break;
    }
    case "divider":
      lines.push(`${indent}---`);
      break;
    case "callout":
      lines.push(`${indent}> ${text}`);
      break;
    case "child_page": {
      const title = asString(payload.title) || "Untitled";
      lines.push(`## ${title}`);
      break;
    }
    default:
      if (text) lines.push(`${indent}${text}`);
      break;
  }

  if (block.has_children) {
    const children = await fetchBlockChildren(token, block.id, pageSize);
    for (const child of children) {
      const rendered = await renderBlock(token, child, pageSize, depth + 1);
      lines.push(...rendered);
    }
  }

  return lines;
}

function squashBlankLines(lines: string[]): string[] {
  const output: string[] = [];
  let previousBlank = false;
  for (const line of lines) {
    const blank = line.trim().length === 0;
    if (blank && previousBlank) continue;
    output.push(line);
    previousBlank = blank;
  }
  return output;
}

async function renderPageContent(
  token: string,
  pageId: string,
  pageSize: number
): Promise<string> {
  const blocks = await fetchBlockChildren(token, pageId, pageSize);
  const lines: string[] = [];
  for (const block of blocks) {
    lines.push(...(await renderBlock(token, block, pageSize, 0)));
    lines.push("");
  }
  return squashBlankLines(lines).join("\n").trim();
}

async function main() {
  const token = process.env.NOTION_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "NOTION_TOKEN is required. Set it in apps/web/.env or current shell env."
    );
  }

  const databaseId = (parseArg("--database") || process.env.NOTION_DATABASE_ID || "").trim();
  if (!databaseId) {
    throw new Error(
      "NOTION_DATABASE_ID is required (set in env or pass --database)."
    );
  }

  const outDir = path.resolve(
    (parseArg("--out") || process.env.NOTION_SYNC_OUT_DIR || "notion-sync").trim()
  );
  const pageSize = normalizePageSize(parseArg("--page-size") || process.env.NOTION_SYNC_PAGE_SIZE || "50");
  const syncedAt = new Date().toISOString();

  await fs.mkdir(outDir, { recursive: true });

  console.log(`Syncing Notion database ${databaseId} -> ${outDir}`);
  const pages = await queryDatabasePages(token, databaseId, pageSize);
  const slugCounts = new Map<string, number>();
  const index: Array<Record<string, string>> = [];

  for (const page of pages) {
    const title = getPageTitle(page.properties).trim() || "Untitled";
    const baseSlug = slugify(title) || `page-${page.id.replace(/-/g, "").slice(0, 12)}`;
    const count = slugCounts.get(baseSlug) || 0;
    slugCounts.set(baseSlug, count + 1);
    const slug = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
    const filename = `${slug}.md`;

    const content = await renderPageContent(token, page.id, pageSize);
    const propertySummary = summarizeProperties(page.properties);
    const fileContent = [
      "---",
      `title: ${yamlQuote(title)}`,
      `notion_page_id: ${yamlQuote(page.id)}`,
      `url: ${yamlQuote(page.url)}`,
      `created_time: ${yamlQuote(page.created_time)}`,
      `last_edited_time: ${yamlQuote(page.last_edited_time)}`,
      `synced_at: ${yamlQuote(syncedAt)}`,
      "---",
      "",
      `# ${title}`,
      "",
      "## Properties",
      "",
      "```json",
      JSON.stringify(propertySummary, null, 2),
      "```",
      "",
      "## Content",
      "",
      content || "_No content_",
      "",
    ].join("\n");

    await fs.writeFile(path.join(outDir, filename), fileContent, "utf8");

    index.push({
      pageId: page.id,
      title,
      file: filename,
      url: page.url,
      lastEditedTime: page.last_edited_time,
    });
    console.log(`Synced: ${title}`);
  }

  await fs.writeFile(
    path.join(outDir, "index.json"),
    JSON.stringify(
      {
        syncedAt,
        databaseId,
        pageCount: index.length,
        pages: index,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Done. Synced ${index.length} pages.`);
}

main().catch((error) => {
  console.error("Failed to sync Notion context:", error);
  process.exitCode = 1;
});
