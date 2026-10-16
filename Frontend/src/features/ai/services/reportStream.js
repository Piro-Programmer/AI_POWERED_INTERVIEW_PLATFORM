// Report generation with live progress, over server-sent events.
// axios can't read a response while it is still arriving, so this uses fetch.

/**
 * Feed text in as it arrives; get back the complete events so far.
 * Events are "event: name\ndata: json" blocks separated by a blank line;
 * ": comment" lines (the server's keep-alive) are ignored.
 */
export function createEventParser() {
  let buffer = "";
  return (text) => {
    buffer += text.replace(/\r\n/g, "\n");
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop(); // the last block may be unfinished
    const events = [];
    for (const block of blocks) {
      let event = "message";
      const data = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (!data.length) continue;
      try {
        events.push({ event, data: JSON.parse(data.join("\n")) });
      } catch {
        // not JSON: skip it rather than break the whole stream
      }
    }
    return events;
  };
}

// Errors look like axios errors ({ response: { status, data } }), so the page
// can handle both paths the same way.
const httpError = (status, data) => Object.assign(new Error(data?.message || `HTTP ${status}`), { response: { status, data } });

/**
 * Generate a report and hear about it while the AI writes.
 * onEvent receives { event: "start" | "section" | "retry", data }.
 * Resolves to the "done" data ({ interviewReport, usage }).
 */
export async function generateReportStream({ resume, selfDescription, jobDescription }, onEvent) {
  const formData = new FormData();
  if (resume) formData.append("resume", resume);
  if (selfDescription) formData.append("selfDescription", selfDescription);
  formData.append("jobDescription", jobDescription);

  const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/interview`, {
    method: "POST",
    body: formData,
    credentials: "include",
    headers: { Accept: "text/event-stream" }
  });

  // problems found before the AI starts come back as plain JSON
  if (!response.ok || !response.headers.get("content-type")?.includes("text/event-stream")) {
    const data = await response.json().catch(() => null);
    throw httpError(response.status, data);
  }

  const parse = createEventParser();
  let result = null;
  const handle = (events) => {
    for (const { event, data } of events) {
      if (event === "done") result = data;
      else if (event === "error") throw httpError(data.status || 500, data);
      else onEvent?.({ event, data });
    }
  };

  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      handle(parse(decoder.decode(value, { stream: true })));
    }
  } else {
    handle(parse(await response.text()));
  }
  handle(parse("\n\n")); // whatever was left in the buffer

  if (!result) throw httpError(500, { message: "The connection closed before the report was ready. Check Your reports in a minute." });
  return result;
}
