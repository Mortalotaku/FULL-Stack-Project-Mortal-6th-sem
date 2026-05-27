const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const {
  readJson, writeJson, uid, seedIfEmpty,
} = require('./lib/store');

const PORT = process.env.PORT || 4000;
const ERP_WEBHOOK_SECRET = process.env.ERP_WEBHOOK_SECRET || 'demo-erp-secret-change-me';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

seedIfEmpty();

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getStudentByErpId(erpStudentId) {
  const students = readJson('students', []);
  return students.find((s) => s.erpStudentId === erpStudentId);
}

function upcomingEvents() {
  const events = readJson('events', []);
  const t = todayStr();
  return events
    .filter((e) => e.date >= t)
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
}

/** ---------- ERP integration ---------- */
app.get('/api/erp/status', (_req, res) => {
  const log = readJson('erpLog', []);
  const students = readJson('students', []);
  res.json({
    linked: true,
    mode: 'webhook + pull (simulated)',
    lastSyncAt: log[0]?.at || null,
    studentRecords: students.length,
    message: 'Configure your college ERP to POST student master data to /api/erp/webhook with header X-ERP-Secret.',
  });
});

app.post('/api/erp/webhook', (req, res) => {
  const secret = req.headers['x-erp-secret'];
  if (secret !== ERP_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid or missing X-ERP-Secret' });
  }

  const { students: incoming } = req.body || {};
  if (!Array.isArray(incoming)) {
    return res.status(400).json({ error: 'Body must include students: []' });
  }

  const existing = readJson('students', []);
  const byId = new Map(existing.map((s) => [s.erpStudentId, s]));

  let upserted = 0;
  for (const row of incoming) {
    if (!row.erpStudentId || !row.fullName) continue;
    byId.set(row.erpStudentId, {
      erpStudentId: String(row.erpStudentId).trim(),
      fullName: String(row.fullName).trim(),
      email: row.email ? String(row.email).trim() : '',
      department: row.department ? String(row.department) : '',
      syncedAt: new Date().toISOString(),
    });
    upserted += 1;
  }

  writeJson('students', [...byId.values()]);

  const log = readJson('erpLog', []);
  log.unshift({
    at: new Date().toISOString(),
    source: 'webhook',
    recordsReceived: incoming.length,
    upserted,
  });
  writeJson('erpLog', log.slice(0, 50));

  res.json({ success: true, upserted, totalStudents: byId.size });
});

/** ---------- Events & clubs ---------- */
app.get('/api/clubs', (_req, res) => {
  res.json(readJson('clubs', []));
});

app.get('/api/events', (_req, res) => {
  const clubs = readJson('clubs', []);
  const clubMap = Object.fromEntries(clubs.map((c) => [c.id, c.name]));
  const events = readJson('events', []);
  const enrollments = readJson('enrollments', []);
  const withMeta = events.map((e) => ({
    ...e,
    clubName: clubMap[e.clubId] || e.clubId,
    enrolledCount: enrollments.filter((x) => x.eventId === e.id).length,
  }));
  res.json(withMeta);
});

app.get('/api/events/upcoming', (_req, res) => {
  const clubs = readJson('clubs', []);
  const clubMap = Object.fromEntries(clubs.map((c) => [c.id, c.name]));
  const enrollments = readJson('enrollments', []);
  const list = upcomingEvents().map((e) => ({
    ...e,
    clubName: clubMap[e.clubId] || e.clubId,
    enrolledCount: enrollments.filter((x) => x.eventId === e.id).length,
  }));
  res.json(list);
});

/** Admin: create event (includes attendance code for verification) */
app.post('/api/events', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== (process.env.ADMIN_KEY || 'admin-demo')) {
    return res.status(401).json({ error: 'Missing X-Admin-Key' });
  }
  const { title, clubId, venue, date, startTime, capacity } = req.body || {};
  if (!title || !clubId || !date) {
    return res.status(400).json({ error: 'title, clubId, date required' });
  }
  const events = readJson('events', []);
  const ev = {
    id: uid('evt'),
    title,
    clubId,
    venue: venue || 'TBA',
    date,
    startTime: startTime || '10:00',
    capacity: Number(capacity) || 100,
    attendanceCode: crypto.randomBytes(4).toString('hex').toUpperCase(),
    createdAt: new Date().toISOString(),
  };
  events.push(ev);
  writeJson('events', events);
  res.status(201).json(ev);
});

/** ---------- Enrollment ---------- */
app.post('/api/enrollments', (req, res) => {
  const { eventId, erpStudentId } = req.body || {};
  if (!eventId || !erpStudentId) {
    return res.status(400).json({ error: 'eventId and erpStudentId required' });
  }

  const student = getStudentByErpId(String(erpStudentId).trim());
  if (!student) {
    return res.status(404).json({
      error: 'Student not found in campus directory. Ask IT to sync ERP or use demo IDs STU-2024-001, 002, 003.',
    });
  }

  const events = readJson('events', []);
  const event = events.find((e) => e.id === eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const enrollments = readJson('enrollments', []);
  if (enrollments.some((e) => e.eventId === eventId && e.erpStudentId === student.erpStudentId)) {
    return res.status(409).json({ error: 'Already enrolled' });
  }

  const count = enrollments.filter((e) => e.eventId === eventId).length;
  if (count >= event.capacity) {
    return res.status(400).json({ error: 'Event is full' });
  }

  const row = {
    id: uid('enr'),
    eventId,
    erpStudentId: student.erpStudentId,
    enrolledAt: new Date().toISOString(),
  };
  enrollments.push(row);
  writeJson('enrollments', enrollments);
  res.status(201).json({ success: true, enrollment: row });
});

app.get('/api/enrollments', (req, res) => {
  const erpStudentId = req.query.erpStudentId;
  if (!erpStudentId) return res.status(400).json({ error: 'erpStudentId query required' });
  const enrollments = readJson('enrollments', []);
  const events = readJson('events', []);
  const mine = enrollments.filter((e) => e.erpStudentId === erpStudentId);
  const withEvent = mine.map((e) => ({
    ...e,
    event: events.find((ev) => ev.id === e.eventId) || null,
  }));
  res.json(withEvent);
});

/** ---------- Verified attendance ---------- */
app.post('/api/attendance/verify', (req, res) => {
  const { eventId, erpStudentId, attendanceCode } = req.body || {};
  if (!eventId || !erpStudentId || !attendanceCode) {
    return res.status(400).json({ error: 'eventId, erpStudentId, attendanceCode required' });
  }

  const student = getStudentByErpId(String(erpStudentId).trim());
  if (!student) {
    return res.status(404).json({ error: 'Unknown ERP student id' });
  }

  const events = readJson('events', []);
  const event = events.find((e) => e.id === eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  if (String(attendanceCode).trim().toUpperCase() !== event.attendanceCode) {
    return res.status(403).json({ error: 'Invalid attendance code — verification failed' });
  }

  const enrollments = readJson('enrollments', []);
  const enrolled = enrollments.some(
    (e) => e.eventId === eventId && e.erpStudentId === student.erpStudentId,
  );
  if (!enrolled) {
    return res.status(403).json({ error: 'Not enrolled in this event. Enroll first.' });
  }

  const attendance = readJson('attendance', []);
  if (attendance.some((a) => a.eventId === eventId && a.erpStudentId === student.erpStudentId)) {
    return res.json({
      success: true,
      alreadyMarked: true,
      message: 'Attendance already recorded',
      eventTitle: event.title,
    });
  }

  attendance.push({
    id: uid('att'),
    eventId,
    erpStudentId: student.erpStudentId,
    verifiedAt: new Date().toISOString(),
    method: 'code+erp',
  });
  writeJson('attendance', attendance);

  res.json({
    success: true,
    verified: true,
    message: 'Attendance verified and recorded',
    eventTitle: event.title,
    studentName: student.fullName,
  });
});

app.get('/api/attendance/event/:eventId', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== (process.env.ADMIN_KEY || 'admin-demo')) {
    return res.status(401).json({ error: 'Missing X-Admin-Key' });
  }
  const { eventId } = req.params;
  const attendance = readJson('attendance', []);
  const students = readJson('students', []);
  const rows = attendance
    .filter((a) => a.eventId === eventId)
    .map((a) => ({
      ...a,
      student: students.find((s) => s.erpStudentId === a.erpStudentId) || null,
    }));
  res.json(rows);
});

/** ---------- Certificates (after verified attendance) ---------- */
function issueCertificateIfEligible(eventId, erpStudentId) {
  const attended = readJson('attendance', []).some(
    (a) => a.eventId === eventId && a.erpStudentId === erpStudentId,
  );
  if (!attended) return null;

  const certificates = readJson('certificates', []);
  if (certificates.some((c) => c.eventId === eventId && c.erpStudentId === erpStudentId)) {
    return certificates.find((c) => c.eventId === eventId && c.erpStudentId === erpStudentId);
  }

  const verifyToken = crypto.randomBytes(16).toString('hex');
  const cert = {
    id: uid('cert'),
    eventId,
    erpStudentId,
    issuedAt: new Date().toISOString(),
    verifyToken,
  };
  certificates.push(cert);
  writeJson('certificates', certificates);
  return cert;
}

app.post('/api/certificates/issue', (req, res) => {
  const { eventId, erpStudentId } = req.body || {};
  if (!eventId || !erpStudentId) {
    return res.status(400).json({ error: 'eventId and erpStudentId required' });
  }
  const attended = readJson('attendance', []).some(
    (a) => a.eventId === eventId && a.erpStudentId === erpStudentId,
  );
  if (!attended) {
    return res.status(400).json({ error: 'Certificate only after verified attendance' });
  }
  const cert = issueCertificateIfEligible(eventId, erpStudentId);
  res.json({ success: true, certificate: cert });
});

app.get('/api/certificates/mine', (req, res) => {
  const erpStudentId = req.query.erpStudentId;
  if (!erpStudentId) return res.status(400).json({ error: 'erpStudentId required' });
  const certificates = readJson('certificates', []);
  const events = readJson('events', []);
  const mine = certificates
    .filter((c) => c.erpStudentId === erpStudentId)
    .map((c) => ({
      ...c,
      event: events.find((e) => e.id === c.eventId) || null,
    }));
  res.json(mine);
});

app.get('/api/certificates/verify', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token query required' });
  const certificates = readJson('certificates', []);
  const students = readJson('students', []);
  const events = readJson('events', []);
  const cert = certificates.find((c) => c.verifyToken === token);
  if (!cert) {
    return res.json({ valid: false, message: 'Certificate not found or invalid token' });
  }
  const student = students.find((s) => s.erpStudentId === cert.erpStudentId);
  const event = events.find((e) => e.id === cert.eventId);
  res.json({
    valid: true,
    issuedAt: cert.issuedAt,
    participant: student ? { name: student.fullName, erpStudentId: student.erpStudentId } : null,
    event: event ? { title: event.title, date: event.date, venue: event.venue } : null,
  });
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  if (req.accepts('html')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Campus Club Platform → http://localhost:${PORT}`);
  console.log(`ERP webhook secret (demo): set ERP_WEBHOOK_SECRET in .env for production`);
});
