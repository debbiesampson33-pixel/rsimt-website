const express = require("express");
const crypto = require("crypto");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || "RSIMT-ADMIN-2026";

const db = new Database(path.join(__dirname, "rsimt.db"));

app.use(express.json());
app.use(express.static(__dirname));

db.exec(`
CREATE TABLE IF NOT EXISTS students(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS results(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL,
  session TEXT NOT NULL,
  semester TEXT NOT NULL,
  course TEXT NOT NULL,
  score INTEGER NOT NULL,
  grade TEXT NOT NULL
);
`);
db.exec(`
CREATE TABLE IF NOT EXISTS staff(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL
);
`);
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return salt + ":" + crypto.scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const actual = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(hash, "hex"));
}

function getGrade(score) {
  if (score >= 70) return "A";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 45) return "D";
  if (score >= 40) return "E";
  return "F";
}

function adminAllowed(req) {
  return req.headers["x-admin-key"] === ADMIN_KEY;
}

app.post("/api/student/login", (req, res) => {
  const { studentId, password } = req.body || {};

  if (!studentId || !password) {
    return res.status(400).json({ message: "Student ID and password are required." });
  }

  const student = db.prepare(
    "SELECT id,student_id,full_name,email,password_hash FROM students WHERE student_id=?"
  ).get(studentId.trim());

  if (!student || !verifyPassword(password, student.password_hash)) {
    return res.status(401).json({ message: "Invalid Student ID or password." });
  }

  res.json({
    student: {
      id: student.id,
      studentId: student.student_id,
      fullName: student.full_name,
      email: student.email
    }
  });
});
app.post("/api/staff/login", (req, res) => {
  const { staffId, password } = req.body || {};

  if (!staffId || !password) {
    return res.status(400).json({
      message: "Staff ID and password are required."
    });
  }

  const staff = db.prepare(
    "SELECT id,staff_id,full_name,email,password_hash FROM staff WHERE staff_id=?"
  ).get(staffId.trim());

  if (!staff || !verifyPassword(password, staff.password_hash)) {
    return res.status(401).json({
      message: "Invalid Staff ID or password."
    });
  }

  res.json({
    staff: {
      id: staff.id,
      staffId: staff.staff_id,
      fullName: staff.full_name,
      email: staff.email
    }
  });
});
app.get("/api/student/:id/results", (req, res) => {
  const rows = db.prepare(
    "SELECT session,semester,course,score,grade FROM results WHERE student_id=? ORDER BY id DESC"
  ).all(req.params.id);

  res.json(rows);
});

// Add a student.
app.post("/api/admin/students", (req, res) => {
  if (!adminAllowed(req)) return res.status(403).json({ message: "Invalid admin key." });

  const { studentId, fullName, email, password } = req.body || {};

  if (!studentId || !fullName || !password) {
    return res.status(400).json({
      message: "Student ID, full name and password are required."
    });
  }


  

  try {
    db.prepare(
      "INSERT INTO students(student_id,full_name,email,password_hash) VALUES(?,?,?,?)"
    ).run(
      studentId.trim(),
      fullName.trim(),
      (email || "").trim(),
      hashPassword(password)
    );

    res.json({ message: "Student added successfully." });
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) {
      return res.status(409).json({ message: "That Student ID already exists." });
    }
    res.status(500).json({ message: "Could not add student." });
  }
});

app.post("/api/admin/staff", (req, res) => {

  const adminKey = req.headers["x-admin-key"];

  if (adminKey !== "RSIMT-ADMIN-2026") {
    return res.status(403).json({
      message: "Invalid admin key."
    });
  }

  const {
    staffId,
    fullName,
    email,
    password
  } = req.body;

  if (!staffId || !fullName || !email || !password) {
    return res.status(400).json({
      message: "All fields are required."
    });
  }

  try {

  db.prepare(
  "INSERT INTO staff (staff_id, full_name, email, password_hash) VALUES (?, ?, ?, ?)"
).run(
  staffId,
  fullName,
  email,
  hashPassword(password)
);

    res.json({
      message: "Staff account created successfully."
    });

  } catch (error) {

    res.status(400).json({
      message: "Staff already exists."
    });

  }

});

// Add a result.
app.post("/api/admin/results", (req, res) => {
  if (!adminAllowed(req)) return res.status(403).json({ message: "Invalid admin key." });

  const { studentId, session, semester, course, score } = req.body || {};
  const numericScore = Number(score);

  if (!studentId || !session || !semester || !course || !Number.isInteger(numericScore)) {
    return res.status(400).json({
      message: "Student ID, session, semester, course and score are required."
    });
  }

  if (numericScore < 0 || numericScore > 100) {
    return res.status(400).json({ message: "Score must be between 0 and 100." });
  }

  const student = db.prepare(
    "SELECT id FROM students WHERE student_id=?"
  ).get(studentId.trim());

  if (!student) {
    return res.status(404).json({ message: "Student ID was not found." });
  }

  db.prepare(
    "INSERT INTO results(student_id,session,semester,course,score,grade) VALUES(?,?,?,?,?,?)"
  ).run(
    studentId.trim(),
    session.trim(),
    semester.trim(),
    course.trim(),
    numericScore,
    getGrade(numericScore)
  );
res.json({ message: "Result added successfully.", grade: getGrade(numericScore) });
});

app.get("/api/staff/students", (req, res) => {
  const students = db.prepare(
    "SELECT student_id, full_name, email FROM students ORDER BY full_name"
  ).all();

  res.json(students);
});

app.get("/api/staff", (req, res) => {

  const staff = db.prepare(
    "SELECT staff_id, full_name, email FROM staff ORDER BY full_name"
  ).all();

  res.json(staff);

});

app.get("/api/results", (req, res) => {

  const results = db.prepare(
 "SELECT id, student_id, session, semester, course, score, grade FROM results ORDER BY id ASC"
  ).all();

  res.json(results);

});

app.get("/api/dashboard-stats", (req, res) => {

  const students = db.prepare(
    "SELECT COUNT(*) AS total FROM students"
  ).get();

  const staff = db.prepare(
    "SELECT COUNT(*) AS total FROM staff"
  ).get();

  const results = db.prepare(
    "SELECT COUNT(*) AS total FROM results"
  ).get();

  res.json({
    students: students.total,
    staff: staff.total,
    results: results.total
  });

});
app.delete("/api/admin/results/:id", (req, res) => {

  if (!adminAllowed(req)) {
    return res.status(403).json({
      message: "Invalid admin key."
    });
  }

  const result = db.prepare(
    "DELETE FROM results WHERE id=?"
  ).run(req.params.id);
  
  if(result.changes === 0){
    return res.status(404).json({
      message: "Result not found."
    });
  }

  res.json({
    message: "Result deleted successfully."
  });

});


app.delete("/api/admin/staff/:staffId", (req, res) => {

  const result = db.prepare(
    "DELETE FROM staff WHERE staff_id=?"
  ).run(req.params.staffId);

  if(result.changes === 0){
    return res.status(404).json({
      message:"Staff not found."
    });
  }

  res.json({
    message:"Staff deleted successfully."
  });

});

// Delete Student
app.delete("/api/admin/students/:studentId", (req, res) => {

  if (!adminAllowed(req)) {
    return res.status(403).json({
      message: "Invalid admin key."
    });
  }

  const result = db.prepare(
    "DELETE FROM students WHERE student_id=?"
  ).run(req.params.studentId);

  if (result.changes === 0) {
    return res.status(404).json({
      message: "Student not found."
    });
  }

  res.json({
    message: "Student deleted successfully."
  });

});
// Delete Staff
app.delete("/api/admin/staff/:staffId", (req, res) => {

  if (!adminAllowed(req)) {
    return res.status(403).json({
      message: "Invalid admin key."
    });
  }

  const result = db.prepare(
    "DELETE FROM staff WHERE staff_id=?"
  ).run(req.params.staffId);

  if (result.changes === 0) {
    return res.status(404).json({
      message: "Staff not found."
    });
  }

  res.json({
    message: "Staff deleted successfully."
  });

});

app.get("/api/students", (req, res) => {

  const students = db.prepare(`
    SELECT student_id, full_name, email
    FROM students
    ORDER BY full_name
  `).all();

  res.json(students);

});


// Unified RSIMT + compulsory JSB student application and correspondence system.
db.exec(`
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_no TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  full_name TEXT NOT NULL,
  dob TEXT, gender TEXT, state_of_origin TEXT, lga TEXT, village TEXT,
  address TEXT, email TEXT, phone TEXT,
  guardian_name TEXT, guardian_relationship TEXT, guardian_phone TEXT,
  previous_school TEXT, qualifications TEXT,
  programme TEXT, department TEXT, level TEXT, session TEXT,
  jsb_course TEXT, skills_interests TEXT, service_interests TEXT,
  christian_journey TEXT, passport_filename TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS student_letters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  letter_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  details TEXT NOT NULL,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'Pending',
  admin_remarks TEXT
);
`);

function clean(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

app.post("/api/applications", (req, res) => {
  const b = req.body || {};
  const fullName = clean(b.fullName, 180);
  if (!fullName || !clean(b.phone, 40) || !clean(b.programme, 180) || !clean(b.session, 30)) {
    return res.status(400).json({ message: "Please complete full name, phone, RSIMT programme and session." });
  }
  const applicationNo = "APP-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomBytes(2).toString("hex").toUpperCase();
  try {
    db.prepare(`INSERT INTO applications (
      application_no, full_name, dob, gender, state_of_origin, lga, village, address, email, phone,
      guardian_name, guardian_relationship, guardian_phone, previous_school, qualifications,
      programme, department, level, session, jsb_course, skills_interests, service_interests,
      christian_journey, passport_filename
    ) VALUES (
      @application_no, @full_name, @dob, @gender, @state_of_origin, @lga, @village, @address, @email, @phone,
      @guardian_name, @guardian_relationship, @guardian_phone, @previous_school, @qualifications,
      @programme, @department, @level, @session, @jsb_course, @skills_interests, @service_interests,
      @christian_journey, @passport_filename
    )`).run({
      application_no: applicationNo, full_name: fullName, dob: clean(b.dob, 20), gender: clean(b.gender, 30),
      state_of_origin: clean(b.stateOfOrigin, 80), lga: clean(b.lga, 100), village: clean(b.village, 120),
      address: clean(b.address, 500), email: clean(b.email, 180), phone: clean(b.phone, 40),
      guardian_name: clean(b.guardianName, 180), guardian_relationship: clean(b.guardianRelationship, 80),
      guardian_phone: clean(b.guardianPhone, 40), previous_school: clean(b.previousSchool, 180),
      qualifications: clean(b.qualifications, 1000), programme: clean(b.programme, 180),
      department: clean(b.department, 180), level: clean(b.level, 80), session: clean(b.session, 30),
      jsb_course: clean(b.jsbCourse, 180), skills_interests: clean(b.skillsInterests, 1000),
      service_interests: clean(b.serviceInterests, 1000), christian_journey: clean(b.christianJourney, 3000),
      passport_filename: clean(b.passportFilename, 255)
    });
    res.status(201).json({ message: "Application submitted. Keep your application number safe.", applicationNo });
  } catch (e) {
    console.error("Application save failed:", e.message);
    res.status(500).json({ message: "Could not save the application. Please try again." });
  }
});

app.get("/api/admin/applications", (req, res) => {
  if (!adminAllowed(req)) return res.status(403).json({ message: "Invalid admin key." });
  res.json(db.prepare("SELECT * FROM applications ORDER BY id DESC").all());
});

app.patch("/api/admin/applications/:id", (req, res) => {
  if (!adminAllowed(req)) return res.status(403).json({ message: "Invalid admin key." });
  const status = clean((req.body || {}).status, 30);
  const allowed = ["Pending", "Approved", "Rejected"];
  if (!allowed.includes(status)) return res.status(400).json({ message: "Choose Pending, Approved or Rejected." });
  const appRow = db.prepare("SELECT * FROM applications WHERE id=?").get(req.params.id);
  if (!appRow) return res.status(404).json({ message: "Application not found." });
  db.prepare("UPDATE applications SET status=?, notes=? WHERE id=?").run(status, clean((req.body || {}).notes, 1000), req.params.id);
  let studentId = null;
  let temporaryPassword = null;
  if (status === "Approved") {
    const base = "RSIMT-" + new Date().getFullYear() + "-" + String(appRow.id).padStart(4, "0");
    studentId = base;
    const exists = db.prepare("SELECT id FROM students WHERE student_id=?").get(studentId);
    if (!exists) {
      temporaryPassword = crypto.randomBytes(9).toString("base64url");
      db.prepare("INSERT INTO students(student_id,full_name,email,password_hash) VALUES(?,?,?,?)")
        .run(studentId, appRow.full_name, appRow.email || "", hashPassword(temporaryPassword));
    }
  }
  res.json({ message: status === "Approved" ? "Application approved." : "Application status updated.", studentId, temporaryPassword });
});

app.post("/api/student-letters", (req, res) => {
  const b = req.body || {};
  const studentId = clean(b.studentId, 80);
  const studentName = clean(b.studentName, 180);
  const letterType = clean(b.letterType, 100);
  const subject = clean(b.subject, 180);
  const details = clean(b.details, 4000);
  if (!studentId || !studentName || !letterType || !subject || !details) {
    return res.status(400).json({ message: "Complete all fields before submitting." });
  }
  const result = db.prepare(`INSERT INTO student_letters(student_id,student_name,letter_type,subject,details)
    VALUES(?,?,?,?,?)`).run(studentId, studentName, letterType, subject, details);
  res.status(201).json({ message: "Your letter/request has been submitted for staff review.", reference: "LTR-" + result.lastInsertRowid });
});

app.get("/api/admin/student-letters", (req, res) => {
  if (!adminAllowed(req)) return res.status(403).json({ message: "Invalid admin key." });
  res.json(db.prepare("SELECT * FROM student_letters ORDER BY id DESC").all());
});

app.patch("/api/admin/student-letters/:id", (req, res) => {
  if (!adminAllowed(req)) return res.status(403).json({ message: "Invalid admin key." });
  const status = clean((req.body || {}).status, 30);
  if (!["Pending", "Under Review", "Approved", "Rejected"].includes(status)) {
    return res.status(400).json({ message: "Choose a valid status." });
  }
  const result = db.prepare("UPDATE student_letters SET status=?, admin_remarks=? WHERE id=?")
    .run(status, clean((req.body || {}).adminRemarks, 2000), req.params.id);
  if (!result.changes) return res.status(404).json({ message: "Letter/request not found." });
  res.json({ message: "Letter/request updated." });
});

app.listen(PORT, () => {
  console.log("RSIMT portal: http://localhost:" + PORT);
});