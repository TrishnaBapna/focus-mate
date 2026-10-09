# Focus Mate 🎓⏱️

A cozy study app that helps students stay focused, organized, and consistent with their study goals.

## Features

* **Focus timer:** Timer, stopwatch, Pomodoro sessions, and custom breaks.
* **Study planner:** Organize study blocks and view your calendar.
* **Tasks:** Track assignments, deadlines, and priorities.
* **Exam countdowns:** Keep track of upcoming exams and syllabus progress.
* **Notes:** Type, handwrite, scan printed text, and record voice notes.
* **Analytics:** Review study time, weekly progress, and subject-wise activity.
* **Achievements:** Earn XP, unlock badges, and build study streaks.
* **Themes:** Choose light mode, dark mode, or system settings.
* **Mobile support:** Use a responsive interface and installable PWA.

## Technology Stack

* React and TypeScript
* Vite and React Router
* CSS
* Firebase Authentication
* Cloud Firestore
* Firebase Hosting
* Tesseract.js for browser-based OCR

## Getting Started

### Requirements

* Node.js 18 or newer
* A Firebase project

### Install dependencies

Open a terminal and run:

```bash
cd frontend
npm install
```

### Configure Firebase

Use `frontend/.env.example` as a template to create `frontend/.env.local`. Fill in the configuration values from your Firebase web app.

Enable Email/Password authentication and set up Cloud Firestore in the Firebase console. Review and publish the security rules from `firestore.rules`.

### Run locally

```bash
npm run dev
```

Open the local URL printed in the terminal, usually `http://localhost:5173`.

### Build for production

```bash
npm run build
```

## Screenshots

Screenshots can be added to `docs/screenshots/` for the dashboard, focus timer, notes, planner, analytics, and mobile layout.

## Privacy and Security

Firestore security rules should restrict access to each user's own data. Review all database paths and test the rules before deploying.

OCR runs in the browser. Features such as microphone recording require browser permissions.

## Future Improvements

* AI-powered summaries, quizzes, and flashcards
* Weekly progress reports
* Smart study recommendations
* Focus rooms and study challenges

## Author

Built by Trishna Bapna.
