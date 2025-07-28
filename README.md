# Timesheet App

A web-based application for tracking work hours, allocating project time, and submitting timesheets for approval—built with Next.js, Firebase, and Tailwind CSS.

## Overview

The Timesheet App helps individual contributors and administrators manage weekly timesheets through:

- Daily time entry with automatic hour calculations  
- Project-based time allocations with descriptions  
- Draft saving, submission workflows, and real-time admin review  
- Exportable history (PDF/CSV) and notification reminders  

## Features

- **Weekly Timesheet Management**  
  Enter and calculate daily In/Out times, breaks, and overtime in a week overview form.

- **Project Allocations**  
  Assign hours to active projects via a type-ahead dropdown and required description field.

- **Validation**  
  Client-side checks ensure that allocated hours never exceed worked hours before submission.

- **Draft & Submission Workflow**  
  Save as draft or, once the week has ended, submit for approval. Submissions are locked until week-end to prevent premature sends.

- **Notifications & Reminders**  
  Users receive in-app alerts as deadlines approach; admins can send push notifications upon approval.

- **Timesheet History & Export**  
  View past weeks, filter by status or date, delete drafts, and export history to CSV or PDF.

- **Admin Portal**  
  Approve or reject submitted timesheets in real time, add review comments, and track metrics like total hours and pending counts.

- **Authentication & Security**  
  Firebase Auth protects all routes, with role checks for admins. Firestore stores user profiles, timesheets, and notifications.

- **Responsive Design**  
  Tailwind CSS ensures a consistent experience across desktop and mobile devices.

## Technologies Used

- **Frontend**: Next.js • React  
- **Backend & Database**: Firebase Auth • Firestore  
- **Styling**: Tailwind CSS  
- **State Management**: React Hooks (`useAuth`, `useProjects`, `useAdminAuth`)  
- **PDF/CSV Export**: `jspdf` & `jspdf-autotable`  
- **Deployment**: Vercel  

## Project Structure
```plaintext
src/
├── pages/
│   ├── dashboard.js
│   ├── time-entry.js
│   ├── time-history.js
│   ├── admin-dashboard.js
│   ├── login.js
│   ├── signup.js
│   └── profile.js
├── hooks/
│   ├── useAuth.js
│   ├── useAdminAuth.js
│   └── useProjects.js
├── lib/
│   └── firebase.js
├── public/
│   └── assets/
│       └── avatar.jpg
└── styles/
    └── globals.css
```

## Installation

1. **Clone the repo**  
   ```sh
   git clone https://github.com/your-username/timesheet-app.git
   cd timesheet-app

2. Install dependencies
    ```sh
    npm install

3. Configure environment variables
    - Create a .env.local in the project root with your Firebase credentials:
    ```sh
    NEXT_PUBLIC_FIREBASE_API_KEY=…
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=…
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=…
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=…
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=…
    NEXT_PUBLIC_FIREBASE_APP_ID=…

4. Run the development server
    ```sh
    npm run dev

5. Open in browser
    - Navigate to http://localhost:3000

## Deployment
1. Push your code to GitHub.
2. Connect the repository in Vercel.
3. Add the same environment variables in the Vercel dashboard.
4. Deploy with a single click.

## Contributing
1. Fork the repository
2. Create a feature branch (git checkout -b feature/YourFeature)
3. Commit your changes (git commit -m 'Add YourFeature')
4. Push to your fork (git push origin feature/YourFeature)
5. Open a Pull Request detailing your improvements

## Questions or feedback?
- Reach out at fkbhimani@gmail.com
