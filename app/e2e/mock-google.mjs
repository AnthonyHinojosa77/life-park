// A stand-in for the Google APIs LifePark reads, for tests.
// Answers with a small, fixed life: a few events, neighbors, lists, mail, and files.
// Usage: node e2e/mock-google.mjs [port]   (or import createMockGoogle in a test)
import http from "node:http";
import { fileURLToPath } from "node:url";

const soon = (days) => new Date(Date.now() + days * 86400000).toISOString();

/** Sam's birthday stays about six months away, so it never counts as coming up soon. */
export const samBirthday = { month: ((new Date().getMonth() + 6) % 12) + 1, day: 3 };

const people = [
  { resourceName: "people/c1", names: [{ displayName: "Sam Rivera" }], birthdays: [{ date: samBirthday }] },
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

// A big life, for looking at a full park: many neighbors, events, letters, and files.
const first = ["Sam", "Priya", "Mom", "Dad", "Jordan", "Alex", "Maya", "Luis", "Grace", "Omar", "Nina", "Theo", "Ava", "Kai", "Rosa", "Eli"];
const last = ["Rivera", "Shah", "Kim", "Okafor", "Nguyen", "Brown", "Silva", "Haddad", "Larsen", "Diaz"];
const big = {
  people: Array.from({ length: 169 }, (_, i) => ({
    resourceName: `people/b${i}`,
    names: [{ displayName: `${first[i % first.length]} ${last[Math.floor(i / first.length) % last.length]}` }],
    ...(i % 4 === 0 ? { birthdays: [{ date: { month: (i % 12) + 1, day: (i % 27) + 1 } }] } : {}),
  })),
  events: Array.from({ length: 81 }, (_, i) => ({ id: `bev${i}`, summary: ["Dentist", "Team lunch", "Gym", "Flight home", "Book club", "Call Mom"][i % 6], start: { dateTime: soon(i - 20) } })),
  mail: Array.from({ length: 25 }, (_, i) => `bm${i}`),
  files: {
    doc: Array.from({ length: 60 }, (_, i) => ({ id: `bd${i}`, name: `Notes ${i + 1}`, mimeType: "application/vnd.google-apps.document", modifiedTime: soon(-i) })),
    sheet: Array.from({ length: 34 }, (_, i) => ({ id: `bs${i}`, name: `Budget ${i + 1}`, mimeType: "application/vnd.google-apps.spreadsheet", modifiedTime: soon(-i) })),
    file: Array.from({ length: 100 }, (_, i) => ({ id: `bf${i}`, name: `Photo ${i + 1}.jpg`, mimeType: "image/jpeg", modifiedTime: soon(-i) })),
  },
};

function route(url, life = "small") {
  const u = new URL(url, "http://mock");
  const p = u.pathname;
  if (life === "big") {
    if (p === "/calendar/v3/calendars/primary/events") return { items: big.events };
    if (p === "/v1/people/me/connections") return { connections: big.people };
    if (p === "/gmail/v1/users/me/messages") return { messages: big.mail.map((id) => ({ id })) };
    const bm = p.match(/^\/gmail\/v1\/users\/me\/messages\/(bm\d+)$/);
    if (bm) return { id: bm[1], payload: { headers: [{ name: "From", value: `${first[bm[1].length % first.length]} <x@example.com>` }, { name: "Subject", value: `Letter ${bm[1]}` }, { name: "Date", value: new Date().toUTCString() }] } };
    if (p === "/drive/v3/files") {
      const q = u.searchParams.get("q") ?? "";
      if (q.includes("mimeType = 'application/vnd.google-apps.document'")) return { files: big.files.doc };
      if (q.includes("mimeType = 'application/vnd.google-apps.spreadsheet'")) return { files: big.files.sheet };
      return { files: big.files.file };
    }
  }
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

/** `life` is "small" (the fixed few things tests expect) or "big" (hundreds, for looking at a full park). */
export function createMockGoogle(life = "small") {
  return http.createServer((req, res) => {
    if (req.headers.authorization !== "Bearer mock-google-token") {
      res.writeHead(401, { "content-type": "application/json" }).end("{}");
      return;
    }
    const body = route(req.url ?? "/", life);
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
