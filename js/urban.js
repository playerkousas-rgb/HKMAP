/** Urban orienteering helpers — QR check-in + photo clues. © Scout System */
export const PUBLISH_KEY = "scout-system-published-v1";
export const CHECKIN_KEY = "scout-system-checkins-v1";

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function ensureIds(course) {
  if (!course.id) course.id = uid();
  (course.controls || []).forEach((c) => {
    if (!c.secret) c.secret = uid();
    if (!c.id) c.id = uid();
  });
  return course;
}

export function checkinUrl(course, ctrl) {
  const u = new URL("checkin.html", window.location.href);
  u.searchParams.set("c", course.id);
  u.searchParams.set("p", ctrl.id);
  u.searchParams.set("k", ctrl.secret);
  u.searchParams.set("code", ctrl.code || "");
  u.searchParams.set("n", ctrl.name || "");
  u.searchParams.set("event", course.name || "");
  return u.toString();
}

export function publishCourse(course) {
  ensureIds(course);
  const all = safeParse(localStorage.getItem(PUBLISH_KEY), {});
  all[course.id] = {
    id: course.id,
    name: course.name,
    type: course.type,
    meet: course.meet,
    cutoff: course.cutoff,
    sos: course.sos,
    controls: (course.controls || []).map((c) => ({
      id: c.id,
      secret: c.secret,
      kind: c.kind,
      code: c.code,
      name: c.name,
      clue: c.clue,
      photo: c.photo || "",
    })),
  };
  localStorage.setItem(PUBLISH_KEY, JSON.stringify(all));
  return course.id;
}

export function loadPublished(id) {
  const all = safeParse(localStorage.getItem(PUBLISH_KEY), {});
  return all[id] || null;
}

export function addCheckin(rec) {
  const all = safeParse(localStorage.getItem(CHECKIN_KEY), {});
  const list = all[rec.courseId] || [];
  const dup = list.find((x) => x.team === rec.team && x.controlId === rec.controlId);
  if (dup) return { ok: false, reason: "already", rec: dup };
  list.push(rec);
  all[rec.courseId] = list;
  localStorage.setItem(CHECKIN_KEY, JSON.stringify(all));
  return { ok: true, rec };
}

export function listCheckins(courseId) {
  const all = safeParse(localStorage.getItem(CHECKIN_KEY), {});
  return all[courseId] || [];
}

export function clearCheckins(courseId) {
  const all = safeParse(localStorage.getItem(CHECKIN_KEY), {});
  delete all[courseId];
  localStorage.setItem(CHECKIN_KEY, JSON.stringify(all));
}

export function compressImage(file, max = 720, q = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", q));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
