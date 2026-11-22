// ==========================================
// 1) البيانات (هنا بتغير المهام)
// ==========================================
// status: "todo" أو "progress" أو "done"
// priority: "high" أو "medium" أو "low"
const tasks = [
  { title: "Design landing page",   priority: "high",   status: "todo",     date: "Apr 20" },
  { title: "Write project docs",    priority: "medium", status: "todo",     date: "Apr 25" },
  { title: "Fix responsive issues", priority: "low",    status: "todo",     date: "Apr 25" },
  { title: "Prepare presentation",  priority: "medium", status: "todo",     date: "Apr 28" },

  { title: "Build dashboard",       priority: "high",   status: "progress", date: "Apr 18" },
  { title: "API integration",       priority: "medium", status: "progress", date: "Apr 19" },
  { title: "Test components",       priority: "low",    status: "progress", date: "Apr 23" },

  { title: "Setup project repo",    priority: "low",    status: "done",     date: "Apr 15" },
  { title: "Create wireframes",     priority: "medium", status: "done",     date: "Apr 12" },
  { title: "Install dependencies",  priority: "low",    status: "done",     date: "Apr 10" }
];

// ترتيب الأعمدة
const statuses = ["todo", "progress", "done"];

// 
const avatarUrl = "https://api.dicebear.com/9.x/avataaars/svg?seed=Ahmed&backgroundColor=dbe9d6&top=shortFlat&hairColor=2c1b18&facialHair=beardLight&facialHairProbability=100&mouth=smile&clothing=hoodie&clothesColor=2e5f44&skinColor=edb98a";

// ==========================================
// 2) حالة الصفحة (اللي بتتغير لما المستخدم يستخدم الفلاتر)
// ==========================================
let priorityFilter = "all";
let statusFilter = "all";
let searchText = "";

// ==========================================
// 3) هل المهمة دي تظهر ولا لأ؟ (بتشوف الفلاتر والبحث)
// ==========================================
function isVisible(task) {
  if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
  if (statusFilter !== "all" && task.status !== statusFilter) return false;
  if (!task.title.toLowerCase().includes(searchText.toLowerCase())) return false;
  return true;
}

// ==========================================
// 4) بناء كارت واحد
// ==========================================
function makeCard(task, index) {
  const card = document.createElement("div");
  card.className = "card";

  // علامة الصح بتظهر بس في Done
  const check = task.status === "done" ? '<div class="check">✓</div>' : "";

  card.innerHTML =
    '<h4 class="card-title">' + task.title + "</h4>" +
    '<div class="card-bottom">' +
      '<div class="card-info">' +
        '<span class="pill ' + task.priority + '">' + task.priority + "</span>" +
        '<span class="date"><img src="https://api.iconify.design/lucide/calendar.svg?color=%235d6f62" alt="">' + task.date + "</span>" +
      "</div>" +
      '<div class="card-right"><img class="mini-avatar" src="' + avatarUrl + '" alt="AM">' + check + "</div>" +
    "</div>";

  // لما تدوسي على الكارت يتنقل للعمود اللي بعده
  card.addEventListener("click", function () {
    const next = (statuses.indexOf(task.status) + 1) % statuses.length;
    tasks[index].status = statuses[next];
    render();
  });

  return card;
}

// ==========================================
// 5) رسم اللوحة كلها من البيانات
// ==========================================
function render() {
  statuses.forEach(function (status) {
    const list = document.getElementById("list-" + status);
    list.innerHTML = "";          // امسح اللي فيه الأول
    let count = 0;

    tasks.forEach(function (task, index) {
      if (task.status !== status) return;   // مش من العمود ده
      if (!isVisible(task)) return;         // الفلتر مخبيها

      list.appendChild(makeCard(task, index));
      count++;
    });

    document.getElementById("count-" + status).textContent = count;
  });
}

// ==========================================
// 6) الفلاتر والبحث
// ==========================================
document.getElementById("filter-priority").addEventListener("change", function (e) {
  priorityFilter = e.target.value;
  render();
});

document.getElementById("filter-status").addEventListener("change", function (e) {
  statusFilter = e.target.value;
  render();
});

document.getElementById("search").addEventListener("input", function (e) {
  searchText = e.target.value;
  render();
});

// ==========================================
// 7) زرار Add Task
// ==========================================
document.getElementById("add-btn").addEventListener("click", function () {
  const title = prompt("اسم المهمة؟");
  if (!title) return;

  const priority = prompt("الأولوية؟ high / medium / low");
  const date = prompt("الموعد؟ (مثلا Apr 30)");

  if (!["high", "medium", "low"].includes(priority) || !date) {
    alert("فيه قيمة غلط، جربي تاني");
    return;
  }

  // المهمة الجديدة بتبدأ في To Do
  tasks.push({ title: title, priority: priority, status: "todo", date: date });
  render();
});

// ==========================================
// 8) شغّل كل حاجة أول ما الصفحة تفتح
// ==========================================
render();