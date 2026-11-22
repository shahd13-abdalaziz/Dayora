// ==========================================
// 1) البيانات (هنا بتغير الجلسات والمهام)
// ==========================================
// day: 0 = الأحد ... 6 = السبت
// start و end بالساعة (13 = 1 PM، و9.5 = 9:30 AM)
const sessions = [
  { title: "Study HTML",     type: "study",    day: 0, start: 9,    end: 11   },
  { title: "Read Docs",      type: "review",   day: 0, start: 14,   end: 15.5 },
  { title: "Team Meeting",   type: "meeting",  day: 1, start: 9.5,  end: 10.5 },
  { title: "Practice JS",    type: "study",    day: 1, start: 13,   end: 15   },
  { title: "Review notes",   type: "review",   day: 1, start: 16,   end: 17   },
  { title: "Design UI",      type: "project",  day: 2, start: 10,   end: 12   },
  { title: "Read Docs",      type: "review",   day: 2, start: 14,   end: 15   },
  { title: "Code Review",    type: "review",   day: 3, start: 11,   end: 12.5 },
  { title: "Project Tasks",  type: "project",  day: 3, start: 15,   end: 17   },
  { title: "Study HTML",     type: "study",    day: 4, start: 9,    end: 10.5 },
  { title: "Practice JS",    type: "study",    day: 4, start: 13,   end: 14.5 },
  { title: "Workout",        type: "personal", day: 4, start: 17,   end: 18   },
  { title: "Design UI",      type: "project",  day: 5, start: 10,   end: 12   },
  { title: "Project Tasks",  type: "project",  day: 5, start: 14,   end: 16   },
  { title: "Weekly recap",   type: "review",   day: 5, start: 16.5, end: 17.5 },
  { title: "Rest and reset", type: "personal", day: 6, start: 11,   end: 12   },
  { title: "Read Docs",      type: "review",   day: 6, start: 15,   end: 16   }
];

const tasks = [
  { title: "Write project docs",    done: false },
  { title: "Fix responsive issues", done: false },
  { title: "Test components",       done: false },
  { title: "Final presentation",    done: true  }
];

const streak = 6;

// ==========================================
// 2) حالة الصفحة (اللي بتتغير لما المستخدم يدوس)
// ==========================================
let filter = "all";   // الفلتر المختار
let selected = 3;     // رقم الجلسة المختارة (3 = Practice JS)

// ==========================================
// 3) دالة مساعدة
// ==========================================
// بتحول 13 إلى "1:00 PM" و 9.5 إلى "9:30 AM"
function formatTime(h) {
  const hour = Math.floor(h);
  const minutes = h % 1 === 0 ? "00" : "30";
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return hour12 + ":" + minutes + " " + suffix;
}

// ==========================================
// 4) الكروت: بتتحسب من البيانات
// ==========================================
function updateCards() {
  let totalHours = 0;
  for (const s of sessions) {
    totalHours += s.end - s.start;
  }

  const tasksLeft = tasks.filter(function (t) { return !t.done; }).length;

  document.getElementById("stat-hours").textContent = totalHours + " hrs";
  document.getElementById("stat-sessions").textContent = sessions.length;
  document.getElementById("stat-tasks").textContent = tasksLeft;
  document.getElementById("stat-streak").textContent = streak + " days";
}

// ==========================================
// 5) الجدول: بيترسم من البيانات
// ==========================================
function renderTable() {
  for (let d = 0; d < 7; d++) {
    const column = document.getElementById("day-" + d);
    column.innerHTML = "";   // امسح اللي فيه الأول

    sessions.forEach(function (s, i) {
      if (s.day !== d) return;                               // مش من اليوم ده
      if (filter !== "all" && s.type !== filter) return;     // الفلتر مش مختاره

      const box = document.createElement("div");
      box.className = "session " + s.type;
      if (i === selected) box.classList.add("selected");

      box.style.top = (s.start - 8) * 64 + 2 + "px";
      box.style.height = (s.end - s.start) * 64 - 4 + "px";

      box.innerHTML =
        "<b>" + s.title + "</b>" +
        "<span>" + formatTime(s.start) + " – " + formatTime(s.end) + "</span>";

      // لما تدوس على الجلسة تبقى هي المختارة
      box.addEventListener("click", function () {
        selected = i;
        renderTable();
      });

      column.appendChild(box);
    });
  }
}

// ==========================================
// 6) الفلاتر (All / Study / Project ...)
// ==========================================
const chips = document.querySelectorAll(".chip");

chips.forEach(function (chip) {
  chip.addEventListener("click", function () {
    filter = chip.dataset.type;

    chips.forEach(function (c) { c.classList.remove("chip-active"); });
    chip.classList.add("chip-active");

    renderTable();
  });
});

// ==========================================
// 7) زرار Add Task
// ==========================================
const addBtn = document.querySelector(".add-btn");

addBtn.addEventListener("click", function () {
  const title = prompt("اسم الجلسة؟");
  if (!title) return;                      // لو قفلتي النافذة أو سبتيها فاضية

  const day   = Number(prompt("اليوم؟ (0 = الأحد ... 6 = السبت)"));
  const start = Number(prompt("بتبدأ الساعة كام؟ (مثلا 13 = 1 PM)"));
  const end   = Number(prompt("بتنتهي الساعة كام؟"));
  const type  = prompt("النوع؟ study / project / meeting / review / personal");

  // تأكد إن القيم منطقية
  const types = ["study", "project", "meeting", "review", "personal"];
  if (day < 0 || day > 6 || start < 8 || end > 19 || end <= start || !types.includes(type)) {
    alert("فيه قيمة غلط، جربي تاني");
    return;
  }

  sessions.push({ title: title, type: type, day: day, start: start, end: end });

  updateCards();   // الأرقام فوق تتحدث
  renderTable();   // الجدول يترسم من جديد
});

// ==========================================
// 8) شغّل كل حاجة أول ما الصفحة تفتح
// ==========================================
updateCards();
renderTable();