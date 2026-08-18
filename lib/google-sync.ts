import "server-only";

import mammoth from "mammoth";
import PostalMime, { type Attachment as ParsedEmailAttachment } from "postal-mime";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  GOOGLE_SHEET_ID,
  GOOGLE_SHEET_TITLE,
  STAFF_SHEET_NAME,
  WORKPLAN_SHEET_NAMES,
  type SheetSnapshot,
  type StaffRecord,
  type WorkplanRecord,
} from "@/lib/sheet-data";
import { persistSheetSnapshot } from "@/lib/shared-snapshot";
import { APPROVED_ROUTINE_WORKBOOKS, type RoutineCadence } from "@/lib/routine-data";
import { SHEET_SOURCE_URL } from "@/lib/workspace-config";

type SheetsMetadata = {
  properties?: { title?: string; locale?: string; timeZone?: string };
  sheets?: Array<{ properties?: { title?: string; sheetId?: number } }>;
};

type ValuesResponse = {
  valueRanges?: Array<{ range?: string; values?: unknown[][] }>;
};

async function googleJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("An authorized Google source could not be read.");
  return await response.json() as T;
}

const asText = (value: unknown) => value == null ? "" : String(value);
const normalizeHeader = (value: unknown) => asText(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function recordFromRow(headers: unknown[], values: unknown[]) {
  return new Map(headers.map((header, index) => [normalizeHeader(header), asText(values[index])]));
}

function staffFromValues(values: unknown[][]): StaffRecord[] {
  const [headers = [], ...rows] = values;
  return rows.flatMap((valuesRow, index) => {
    const row = recordFromRow(headers, valuesRow);
    const name = row.get("all staff")?.trim() || "";
    if (!name) return [];
    const sourceRow = index + 2;
    return [{
      id: `${STAFF_SHEET_NAME}:${sourceRow}`,
      sourceSheet: STAFF_SHEET_NAME,
      sourceRow,
      name,
      organization: row.get("organization") || "",
      role: row.get("role") || "",
      department: row.get("department") || "",
      email: row.get("email") || "",
    }];
  });
}

function workplanFromValues(sheet: (typeof WORKPLAN_SHEET_NAMES)[number], values: unknown[][]): WorkplanRecord[] {
  const [headers = [], ...rows] = values;
  return rows.flatMap((valuesRow, index) => {
    const row = recordFromRow(headers, valuesRow);
    const fields = {
      currentAssignment: row.get("current assignment") || "",
      catNotes: row.get("cat notes") || "",
      originalDueDate: row.get("original due date") || "",
      newDueDate: row.get("new due date") || "",
      community: row.get("community") || "",
      collaborator: row.get("collaborator") || "",
      sourceStatus: row.get("status") || "",
      notes: row.get("notes") || "",
      newAssignment: row.get("new assignment") || "",
    };
    if (!Object.values(fields).some((value) => value.trim())) return [];
    const sourceRow = index + 2;
    return [{ id: `${sheet}:${sourceRow}`, sourceSheet: sheet, sourceRow, owner: sheet, ...fields }];
  });
}

export async function syncGoogleSheet(client: SupabaseClient, accessToken: string, runId: string, identity: { sub: string; email: string; name?: string }) {
  const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}`;
  const metadata = await googleJson<SheetsMetadata>(`${baseUrl}?fields=properties(title,locale,timeZone),sheets(properties(title,sheetId))`, accessToken);
  const availableTabs = new Set(metadata.sheets?.map((sheet) => sheet.properties?.title || ""));
  const requiredTabs = [STAFF_SHEET_NAME, ...WORKPLAN_SHEET_NAMES];
  if (metadata.properties?.title !== GOOGLE_SHEET_TITLE || requiredTabs.some((tab) => !availableTabs.has(tab))) {
    throw new Error("The authorized workbook does not match the required Staff Details and Task source.");
  }

  const params = new URLSearchParams({ majorDimension: "ROWS", valueRenderOption: "FORMATTED_VALUE" });
  requiredTabs.forEach((tab) => params.append("ranges", `'${tab}'`));
  const values = await googleJson<ValuesResponse>(`${baseUrl}/values:batchGet?${params}`, accessToken);
  const byTab = new Map<string, unknown[][]>();
  requiredTabs.forEach((tab, index) => byTab.set(tab, values.valueRanges?.[index]?.values ?? []));
  const staff = staffFromValues(byTab.get(STAFF_SHEET_NAME) ?? []);
  const tasks = WORKPLAN_SHEET_NAMES.flatMap((tab) => workplanFromValues(tab, byTab.get(tab) ?? []));
  const refreshedAt = new Date().toISOString();

  const snapshot: SheetSnapshot = {
    version: 1,
    source: {
      spreadsheetId: GOOGLE_SHEET_ID,
      title: GOOGLE_SHEET_TITLE,
      url: SHEET_SOURCE_URL,
      locale: metadata.properties?.locale || "en_GB",
      timeZone: metadata.properties?.timeZone || "America/Winnipeg",
      verifiedTabs: requiredTabs,
    },
    connector: {
      identity: { id: identity.sub, name: identity.name || identity.email, email: identity.email },
      retrievedAt: refreshedAt,
      mappingMode: "Shared Google OAuth",
      writeMode: "Read-only",
    },
    counts: { staff: staff.length, tasks: tasks.length },
    staff,
    tasks,
  };

  await persistSheetSnapshot(client, snapshot, runId, refreshedAt);
  return snapshot.counts;
}

const ROUTINE_HEADER_ALIASES = {
  task: ["task", "tasks", "routine", "responsibility", "responsibilities", "activity", "activities", "duty", "duties", "task description", "description"],
  schedule: ["schedule", "time", "day", "due", "frequency", "timeline", "when"],
  category: ["category", "type", "group"],
  status: ["status", "completion status", "state"],
  notes: ["notes", "note", "comments", "comment", "details"],
} as const;

function routineCadence(sheetName: string): RoutineCadence | null {
  if (/daily/i.test(sheetName)) return "Daily";
  if (/weekly/i.test(sheetName)) return "Weekly";
  if (/monthly/i.test(sheetName)) return "Monthly";
  return null;
}

function headerMatchesAlias(headerValue: string, alias: string) {
  return headerValue === alias || headerValue.startsWith(`${alias} `) || headerValue.endsWith(` ${alias}`) || headerValue.includes(` ${alias} `);
}

function aliasValue(row: Map<string, string>, aliases: readonly string[]) {
  for (const alias of aliases) {
    const value = row.get(alias)?.trim();
    if (value) return value;
  }
  for (const [headerValue, value] of row) {
    if (value.trim() && aliases.some((alias) => headerMatchesAlias(headerValue, alias))) return value.trim();
  }
  return "";
}

function routineRows(
  workbook: (typeof APPROVED_ROUTINE_WORKBOOKS)[number],
  workbookName: string,
  sheetName: string,
  values: unknown[][],
  organizationIds: string[],
  runId: string,
  refreshedAt: string,
) {
  const cadence = routineCadence(sheetName);
  if (!cadence) return [];
  const headerIndex = values.slice(0, 25).findIndex((candidate) => {
    const normalized = candidate.map(normalizeHeader);
    return normalized.some((headerValue) => ROUTINE_HEADER_ALIASES.task.some((alias) => headerMatchesAlias(headerValue, alias)));
  });
  if (headerIndex < 0) return [];

  const headers = values[headerIndex];
  let section = "";
  return values.slice(headerIndex + 1).flatMap((valuesRow, index) => {
    const row = recordFromRow(headers, valuesRow);
    const task = aliasValue(row, ROUTINE_HEADER_ALIASES.task);
    if (!task) return [];
    const schedule = aliasValue(row, ROUTINE_HEADER_ALIASES.schedule);
    const category = aliasValue(row, ROUTINE_HEADER_ALIASES.category);
    const sourceStatus = aliasValue(row, ROUTINE_HEADER_ALIASES.status);
    const notes = aliasValue(row, ROUTINE_HEADER_ALIASES.notes);
    if (![schedule, category, sourceStatus, notes].some(Boolean)) {
      section = task;
      return [];
    }
    const sourceRow = headerIndex + index + 2;
    return [{
      id: `${workbook.id}:${sheetName}:${sourceRow}`,
      workbook_id: workbook.id,
      workbook_name: workbookName,
      sheet_name: sheetName,
      source_row: sourceRow,
      owner: workbook.owner,
      cadence,
      section,
      task,
      schedule,
      category,
      source_status: sourceStatus,
      notes,
      organization_ids: organizationIds,
      source_url: `https://docs.google.com/spreadsheets/d/${workbook.id}/edit`,
      sync_run_id: runId,
      refreshed_at: refreshedAt,
    }];
  });
}

export async function syncRoutineWorkbooks(client: SupabaseClient, accessToken: string, runId: string) {
  const { data: staff, error: staffError } = await client.from("staff_records").select("name,organization_ids");
  if (staffError) throw new Error("Staff organization mappings could not be read for the routine refresh.");
  const organizationsByOwner = new Map(
    (staff ?? []).map((person) => [String(person.name).trim().toLowerCase(), (person.organization_ids ?? []) as string[]]),
  );
  const refreshedAt = new Date().toISOString();
  const records: Record<string, unknown>[] = [];

  for (const workbook of APPROVED_ROUTINE_WORKBOOKS) {
    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${workbook.id}`;
    const metadata = await googleJson<SheetsMetadata>(`${baseUrl}?fields=properties(title),sheets(properties(title,sheetId))`, accessToken);
    const tabs = (metadata.sheets ?? [])
      .map((sheet) => sheet.properties?.title || "")
      .filter((title) => routineCadence(title));
    if (!tabs.length) throw new Error(`No Daily, Weekly, or Monthly sheets were found in ${workbook.name}.`);
    const params = new URLSearchParams({ majorDimension: "ROWS", valueRenderOption: "FORMATTED_VALUE" });
    tabs.forEach((tab) => params.append("ranges", `'${tab.replace(/'/g, "''")}'`));
    const values = await googleJson<ValuesResponse>(`${baseUrl}/values:batchGet?${params}`, accessToken);
    tabs.forEach((tab, index) => records.push(...routineRows(
      workbook,
      metadata.properties?.title || workbook.name,
      tab,
      values.valueRanges?.[index]?.values ?? [],
      organizationsByOwner.get(workbook.owner.toLowerCase()) ?? [],
      runId,
      refreshedAt,
    )));
  }

  for (let index = 0; index < records.length; index += 100) {
    const { error } = await client.from("routine_records").upsert(records.slice(index, index + 100));
    if (error) throw new Error("The shared routine snapshot could not be saved.");
  }
  const { error: staleError } = await client.from("routine_records").delete().neq("sync_run_id", runId);
  if (staleError) throw new Error("The shared routine snapshot could not be finalized.");
  return { routines: records.length };
}

type GmailListResponse = { messages?: Array<{ id: string; threadId: string }>; nextPageToken?: string };
type GmailHeader = { name: string; value: string };
type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; attachmentId?: string };
  parts?: GmailPart[];
};
type GmailMessage = {
  id: string;
  threadId: string;
  internalDate?: string;
  payload?: GmailPart;
};
type GmailAttachmentResponse = { data?: string; size?: number };

function bytesFromBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function decodeBase64Url(value: string) {
  return bytesFromBase64Url(value).toString("utf8");
}

function stripHtml(value: string) {
  return value.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function parsedAttachmentBytes(attachment: ParsedEmailAttachment) {
  if (typeof attachment.content === "string") {
    return Buffer.from(attachment.content, attachment.encoding === "base64" ? "base64" : "utf8");
  }
  return attachment.content instanceof ArrayBuffer
    ? Buffer.from(new Uint8Array(attachment.content))
    : Buffer.from(attachment.content);
}

async function readableAttachmentText(filename: string, mimeType: string, bytes: Buffer, depth = 0): Promise<string> {
  if (depth > 2 || bytes.length > 10_000_000) return "";
  const normalizedName = filename.toLowerCase();
  if (normalizedName.endsWith(".txt") || mimeType.startsWith("text/plain")) return bytes.toString("utf8");
  if (normalizedName.endsWith(".docx") || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return (await mammoth.extractRawText({ buffer: bytes })).value;
  }
  if (normalizedName.endsWith(".eml") || mimeType === "message/rfc822") {
    const email = await PostalMime.parse(bytes, {
      attachmentEncoding: "arraybuffer",
      rfc822Attachments: true,
      maxNestingDepth: 20,
      maxRfc822NestingDepth: 3,
    });
    const parts = [email.text || stripHtml(email.html || "")];
    for (const attachment of email.attachments) {
      const nested = await readableAttachmentText(
        attachment.filename || "attachment",
        attachment.mimeType,
        parsedAttachmentBytes(attachment),
        depth + 1,
      );
      if (nested.trim()) parts.push(nested);
    }
    return parts.filter(Boolean).join("\n\n");
  }
  return "";
}

async function collectMessageContent(
  part: GmailPart | undefined,
  messageId: string,
  accessToken: string,
  plainBodies: string[],
  htmlBodies: string[],
  attachments: string[],
  attachmentTexts: string[],
) {
  if (!part) return;
  if (part.filename) attachments.push(part.filename);
  if (part.body?.data && part.mimeType === "text/plain" && !part.filename) plainBodies.push(decodeBase64Url(part.body.data));
  if (part.body?.data && part.mimeType === "text/html" && !part.filename) htmlBodies.push(stripHtml(decodeBase64Url(part.body.data)));
  if (part.filename && (part.body?.attachmentId || part.body?.data)) {
    try {
      const bytes = part.body.attachmentId
        ? bytesFromBase64Url((await googleJson<GmailAttachmentResponse>(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${part.body.attachmentId}`,
            accessToken,
          )).data || "")
        : bytesFromBase64Url(part.body.data || "");
      const extracted = await readableAttachmentText(part.filename, part.mimeType || "application/octet-stream", bytes);
      if (extracted.trim()) attachmentTexts.push(`${part.filename}\n${extracted.trim()}`);
    } catch {
      // Keep the attachment name as source evidence when a readable extraction fails.
    }
  }
  for (const child of part.parts ?? []) {
    await collectMessageContent(child, messageId, accessToken, plainBodies, htmlBodies, attachments, attachmentTexts);
  }
}

function header(headers: GmailHeader[] | undefined, name: string) {
  return headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value || "";
}

export async function syncGmailEvidence(client: SupabaseClient, accessToken: string, runId: string, mailboxEmail: string) {
  const messages: Array<{ id: string; threadId: string }> = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({ q: "in:anywhere otter -in:spam -in:trash", maxResults: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await googleJson<GmailListResponse>(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, accessToken);
    messages.push(...(page.messages ?? []));
    pageToken = page.nextPageToken || "";
  } while (pageToken && messages.length < 500);

  const records: Record<string, unknown>[] = [];
  for (let index = 0; index < messages.length; index += 10) {
    const page = await Promise.all(messages.slice(index, index + 10).map(({ id }) =>
      googleJson<GmailMessage>(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, accessToken),
    ));
    for (const message of page) {
      const plainBodies: string[] = [];
      const htmlBodies: string[] = [];
      const attachments: string[] = [];
      const attachmentTexts: string[] = [];
      await collectMessageContent(message.payload, message.id, accessToken, plainBodies, htmlBodies, attachments, attachmentTexts);
      const headers = message.payload?.headers;
      const bodyText = (plainBodies.length ? plainBodies : htmlBodies).join("\n\n").trim();
      records.push({
        id: message.id,
        gmail_thread_id: message.threadId,
        gmail_message_id: message.id,
        mailbox_email: mailboxEmail,
        organization_ids: [],
        source_title: header(headers, "Subject") || "Not provided",
        sender: header(headers, "From"),
        recipients: header(headers, "To"),
        sent_at: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null,
        evidence_kind: "Gmail message",
        body_text: bodyText.slice(0, 200_000),
        attachment_names: [...new Set(attachments)],
        attachment_text: attachmentTexts.join("\n\n").slice(0, 200_000),
        source_url: `https://mail.google.com/mail/u/0/#all/${message.id}`,
        sync_run_id: runId,
        refreshed_at: new Date().toISOString(),
      });
    }
  }

  for (let index = 0; index < records.length; index += 100) {
    const { error } = await client.from("message_evidence").upsert(records.slice(index, index + 100));
    if (error) throw new Error("The shared Gmail evidence snapshot could not be saved.");
  }
  await client.from("message_evidence").delete().neq("sync_run_id", runId);
  return { messages: records.length };
}
