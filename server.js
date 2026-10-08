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

app.listen(PORT, () => {
  console.log("RSIMT portal: http://localhost:" + PORT);
});