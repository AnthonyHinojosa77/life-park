// A stand-in for the Google APIs LifePark reads, for tests.
// Answers with a small, fixed life: a few events, neighbors, lists, mail, and files.
// Usage: node e2e/mock-google.mjs [port]   (or import createMockGoogle in a test)
import http from "node:http";
import { fileURLToPath } from "node:url";

const soon = (days) => new Date(Date.now() + days * 86400000).toISOString();

const people = [
  { resourceName: "people/c1", names: [{ displayName: "Sam Rivera" }], birthdays: [{ date: { month: 11, day: 3 } }] },
  { resourceName: "people/c2", names: [{ displayName: "Mom" }], birthdays: [{ date: { year: 1965, month: 5, day: 12 } }] },
  { resourceName: "people/c3", names: [{ displayName: "Priya Shah" }] },
  { resourceName: "people/c4" },
];

const files = {
  doc: [{ id: "d1", name: "Trip ideas", mimeType: "application/vnd.google-apps.document", modifiedTime: soon(-2) }],
  sheet: [{ id: "s1", name: "Budget 2026", mimeType: "application/vnd.google-apps.spreadsheet", modifiedTime: soon(-1) }],
  file: [
    { id: "f1", name: "Lease.pdf", mimeType: "application/pdf", modifiedTime: soon(-9) },
    { id: "f2", name: "Beach.jpg", mimeType: "image/jpeg", modifiedTime: soon(-4) },
  ],
};

function route(url) {
  const u = new URL(url, "http://mock");
  const p = u.pathname;
  if (p === "/calendar/v3/calendars/primary/events") {
    return {
      items: [
        { id: "ev1", summary: "Dentist", start: { dateTime: soon(3) } },
        { id: "ev2", summary: "Sam's birthday dinner", start: { date: soon(10).slice(0, 10) }, location: "Luigi's" },
        { id: "ev3", summary: "Old plan", status: "cancelled", start: { dateTime: soon(1) } },
      ],
    };
  }
  if (p === "/v1/people/me/connections") return { connections: people };
  if (p === "/tasks/v1/users/@me/lists") return { items: [{ id: "L1", title: "Groceries" }, { id: "L2", title: "Weekend" }] };
  if (p === "/tasks/v1/lists/L1/tasks") return { items: [{ title: "Eggs" }, { title: "Coffee", due: soon(1) }] };
  if (p === "/tasks/v1/lists/L2/tasks") return { items: [{ title: "Fix the bike" }] };
  if (p === "/gmail/v1/users/me/messages") return { messages: [{ id: "m1" }, { id: "m2" }] };
  const msg = p.match(/^\/gmail\/v1\/users\/me\/messages\/(m\d)$/);
  if (msg) {
    return {
      id: msg[1],
      payload: {
        headers: [
          { name: "From", value: msg[1] === "m1" ? "Sam Rivera <sam@example.com>" : "Airline <no-reply@example.com>" },
          { name: "Subject", value: msg[1] === "m1" ? "Dinner Friday?" : "Your trip is booked" },
          { name: "Date", value: new Date().toUTCString() },
        ],
      },
    };
  }
  if (p === "/drive/v3/files") {
    const q = u.searchParams.get("q") ?? "";
    if (q.includes("mimeType = 'application/vnd.google-apps.document'")) return { files: files.doc };
    if (q.includes("mimeType = 'application/vnd.google-apps.spreadsheet'")) return { files: files.sheet };
    return { files: files.file };
  }
  return null;
}

export function createMockGoogle() {
  return http.createServer((req, res) => {
    if (req.headers.authorization !== "Bearer mock-google-token") {
      res.writeHead(401, { "content-type": "application/json" }).end("{}");
      return;
    }
    const body = route(req.url ?? "/");
    if (!body) {
      res.writeHead(404, { "content-type": "application/json" }).end("{}");
      return;
    }
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(body));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? 3125);
  createMockGoogle().listen(port, () => console.log(`mock google on ${port}`));
}
