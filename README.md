# FocusFlow 💫

### Smart Productivity & Study Planner

**Plan smarter. Focus deeper. Achieve more.**

FocusFlow is a web-based productivity and study planning platform that helps students and individuals organize tasks, manage projects, track focus sessions, and monitor their progress in one place.

## 🎯 Project Overview

Managing assignments, deadlines, and multiple projects can be challenging. FocusFlow aims to simplify productivity by turning large goals into manageable tasks, organizing work by priority, and helping users stay focused.

### ✨ Key Features

#### Core Features

* **Task Management:** Create, edit, delete, and organize tasks.
* **Priority Management:** Assign importance levels and deadlines.
* **Search & Filtering:** Find tasks by title, status, or priority.
* **Interactive Dashboard:** View task statistics and completion progress.
* **Local Storage:** Save tasks and settings in the browser.
* **Responsive Design:** Support desktop, tablet, and mobile screens.

#### Advanced Features — Planned

* **Smart Priority Score:** Rank tasks based on urgency, importance, and estimated effort.
* **Weekly Planner:** Organize tasks across the week.
* **Focus Timer:** Track focus sessions and breaks.
* **Productivity Analytics:** Visualize progress and focus time.
* **Project Subtasks:** Break large goals into smaller tasks.

#### Bonus Features — Planned

* Dark mode.
* CSV export.
* In-app deadline reminders.
* Keyboard shortcuts.
* Progressive Web App (PWA) support.

> Note: Features will be implemented incrementally. Planned features are not necessarily available in the current version.

## 🛠️ Tech Stack

| Technology    | Purpose                             |
| ------------- | ----------------------------------- |
| HTML5         | Page structure                      |
| CSS3          | Styling and responsive design       |
| JavaScript    | Application logic and interactivity |
| Bootstrap     | Responsive UI components            |
| Chart.js      | Charts and analytics (planned)      |
| Local Storage | Browser-based data persistence      |

## 🎨 Design System

FocusFlow uses a clean, modern, and distraction-free interface.

* **Primary:** `#6750A4`
* **Lavender:** `#EAE4F7`
* **Success:** `#E2F3E8`
* **Warning:** `#FFF0D9`
* **Fonts:** Inter for English and Cairo for Arabic support.

## 📄 Application Pages

| Page           | Purpose                                  |
| -------------- | ---------------------------------------- |
| Landing Page   | Introduce the platform and its benefits  |
| Dashboard      | Summarize tasks, deadlines, and progress |
| Tasks          | Manage tasks, priorities, and statuses   |
| Weekly Planner | Organize tasks by day                    |
| Focus Room     | Run focus sessions and breaks            |
| Analytics      | Review productivity statistics           |
| Settings       | Customize preferences and export data    |

## 📁 Project Structure

```text
FocusFlow/
├── index.html
├── pages/
├── assets/
│   ├── images/
│   └── icons/
├── css/
│   ├── style.css
│   ├── layout.css
│   ├── components.css
│   └── responsive.css
├── js/
│   ├── utils/
│   │   ├── storage.js
│   │   ├── date-utils.js
│   │   └── priority.js
│   ├── components/
│   ├── tasks.js
│   ├── dashboard.js
│   ├── planner.js
│   ├── timer.js
│   ├── analytics.js
│   └── app.js
├── README.md
└── .gitignore
```

*The structure will be expanded as development progresses.*

## 🚀 Getting Started

### Prerequisites

* A modern web browser.
* Git.
* Visual Studio Code (recommended).
* Live Server extension for VS Code (recommended).

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/shahd13-abdalaziz/FocusFlow.git
   ```

2. Open the project directory:

   ```bash
   cd FocusFlow
   ```

3. Open the project in VS Code:

   ```bash
   code .
   ```

4. Run `index.html` using Live Server.

The initial static version does not require a package installation.

## 💾 Data Storage

The initial prototype will use browser Local Storage.

| Storage Key          | Description              |
| -------------------- | ------------------------ |
| `focusflow_tasks`    | Task records             |
| `focusflow_projects` | Project records          |
| `focusflow_sessions` | Completed focus sessions |
| `focusflow_settings` | User preferences         |

Local Storage keeps data in the current browser and does not automatically synchronize it across devices or users.

## 🤝 Team Collaboration

The project uses Git and GitHub for version control and collaboration.

* Create feature branches for individual tasks.
* Use clear and descriptive commit messages.
* Open Pull Requests for code review.
* Test changes before merging into `main`.
* Keep shared components and data structures consistent.

### Branch Naming Examples

* `feature/landing-page`
* `feature/task-management`
* `feature/weekly-planner`
* `feature/focus-timer`
* `feature/dashboard`

### Commit Message Examples

* `feat: add task creation form`
* `feat: implement task filtering`
* `fix: handle invalid deadlines`
* `style: improve responsive layout`
* `docs: update project README`

## 🗺️ Development Roadmap

* [ ] Initialize the project structure.
* [ ] Build the initial UI and shared components.
* [ ] Implement task management and local storage.
* [ ] Develop the dashboard and basic statistics.
* [ ] Build the weekly planner and focus timer.
* [ ] Implement smart priority scoring.
* [ ] Add analytics and CSV export.
* [ ] Test responsive layouts and fix bugs.
* [ ] Complete documentation and prepare the final presentation.

## 🔮 Future Improvements

Potential improvements include user authentication, cloud storage, cross-device synchronization, collaborative projects, and personalized productivity insights.

## 👥 Contributors

Developed collaboratively by the FocusFlow project team.

*Team members and GitHub profiles will be added here.*

---

**FocusFlow — Turn your goals into progress.**
