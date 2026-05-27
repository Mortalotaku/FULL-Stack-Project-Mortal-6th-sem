const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');

const FILES = {
  students: 'students.json',
  clubs: 'clubs.json',
  events: 'events.json',
  enrollments: 'enrollments.json',
  attendance: 'attendance.json',
  certificates: 'certificates.json',
  erpLog: 'erp_sync_log.json',
};

function readJson(name, fallback) {
  const fp = path.join(DATA_DIR, FILES[name]);
  if (!fs.existsSync(fp)) return JSON.parse(JSON.stringify(fallback));
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function writeJson(name, data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const fp = path.join(DATA_DIR, FILES[name]);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
}

function uid(prefix) {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

function hashToken(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex').slice(0, 32);
}

/** Default seed when DB empty */
function seedIfEmpty() {
  const students = readJson('students', []);
  if (students.length) return;

  const demoStudents = [
    { erpStudentId: 'STU-2024-001', fullName: 'Aisha Khan', email: 'aisha@college.edu', department: 'CS', syncedAt: new Date().toISOString() },
    { erpStudentId: 'STU-2024-002', fullName: 'Rohan Mehta', email: 'rohan@college.edu', department: 'ECE', syncedAt: new Date().toISOString() },
    { erpStudentId: 'STU-2024-003', fullName: 'Priya Nair', email: 'priya@college.edu', department: 'Mech', syncedAt: new Date().toISOString() },
  ];
  writeJson('students', demoStudents);

  const clubs = [
    { id: 'club-tech', name: 'Tech Club', description: 'Coding, hackathons, workshops' },
    { id: 'club-culture', name: 'Cultural Society', description: 'Music, dance, fest' },
  ];
  writeJson('clubs', clubs);

  const now = new Date();
  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x.toISOString().slice(0, 10);
  };

  const events = [
    {
      id: 'evt-1',
      title: 'Inter-College Hackathon 2026',
      clubId: 'club-tech',
      venue: 'Main Auditorium',
      date: addDays(now, 7),
      startTime: '09:00',
      capacity: 120,
      attendanceCode: crypto.randomBytes(4).toString('hex').toUpperCase(),
      createdAt: new Date().toISOString(),
    },
    {
      id: 'evt-2',
      title: 'Spring Fest — Open Mic',
      clubId: 'club-culture',
      venue: 'Open Air Theatre',
      date: addDays(now, 14),
      startTime: '17:00',
      capacity: 200,
      attendanceCode: crypto.randomBytes(4).toString('hex').toUpperCase(),
      createdAt: new Date().toISOString(),
    },
    {
      id: 'evt-3',
      title: 'Industry Talk: AI in Campus',
      clubId: 'club-tech',
      venue: 'Seminar Hall A',
      date: addDays(now, 21),
      startTime: '15:30',
      capacity: 80,
      attendanceCode: crypto.randomBytes(4).toString('hex').toUpperCase(),
      createdAt: new Date().toISOString(),
    },
  ];
  writeJson('events', events);
  writeJson('enrollments', []);
  writeJson('attendance', []);
  writeJson('certificates', []);
  writeJson('erpLog', []);
}

module.exports = {
  readJson,
  writeJson,
  uid,
  hashToken,
  seedIfEmpty,
  DATA_DIR,
};
