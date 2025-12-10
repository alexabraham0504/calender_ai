# Calendar AI 📅🤖

An intelligent calendar management system with AI-powered event scheduling, workspace collaboration, and smart suggestions.

## Features

### 🎯 Core Features
- **AI-Powered Event Scheduling**: Natural language event creation with smart parsing
- **Multiple Calendar Views**: Year, Month, Week, and Day views
- **Event Management**: Create, edit, delete, and manage recurring events
- **Smart Suggestions**: AI-driven event recommendations and scheduling optimization
- **Holiday Integration**: Automatic holiday detection for India

### 👥 Collaboration
- **Workspaces**: Create and manage shared calendar workspaces
- **Role-Based Access**: Owner, Admin, Member, and Viewer roles
- **Invite System**: Join code-based workspace invitations
- **Member Management**: Add, remove, and manage workspace members

### 🔐 Security & Authentication
- **Firebase Authentication**: Secure user authentication
- **JWT Tokens**: Protected API endpoints
- **Role-Based Permissions**: Granular access control

## Tech Stack

### Frontend
- **Framework**: Astro with React components
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Hooks
- **Database**: Firebase Firestore (realtime sync)
- **Authentication**: Firebase Auth

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: Firebase Firestore
- **Authentication**: Firebase Admin SDK
- **AI Integration**: Custom AI service for natural language processing

## Project Structure

```
calender_file/
├── frontend/                 # Astro + React frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Astro pages
│   │   ├── config/          # Firebase & app configuration
│   │   ├── utils/           # Utility functions
│   │   └── styles/          # Global styles
│   └── package.json
│
└── backend/                 # Node.js + Express backend
    ├── src/
    │   ├── controllers/     # Route controllers
    │   ├── middleware/      # Authentication & validation
    │   ├── routes/          # API routes
    │   ├── services/        # Business logic
    │   └── config/          # Firebase Admin configuration
    └── package.json
```

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Firebase project with Firestore enabled

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/alexabraham0504/calender_ai.git
   cd calender_ai
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   
   # Create .env file with your credentials
   # See .env.example for required variables
   
   npm run dev
   ```

3. **Setup Frontend**
   ```bash
   cd frontend
   npm install
   
   # Update src/config/firebase.ts with your Firebase config
   
   npm run dev
   ```

### Environment Variables

#### Backend (.env)
```env
PORT=5000
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
JWT_SECRET=your-jwt-secret
AI_BACKEND_URL=http://localhost:8000
```

#### Frontend
Firebase configuration in `src/config/firebase.ts`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login

### Events
- `GET /api/events` - Get all events
- `POST /api/events` - Create event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

### Workspaces
- `GET /api/workspaces` - Get user workspaces
- `POST /api/workspaces` - Create workspace
- `POST /api/workspaces/join` - Join workspace
- `PUT /api/workspaces/:id/members/:userId/role` - Update member role
- `DELETE /api/workspaces/:id/members/:userId` - Remove member

### AI Features
- `POST /api/ai/parse-event` - Parse natural language event
- `POST /api/ai/suggestions` - Get AI scheduling suggestions

## Features in Detail

### AI-Powered Scheduling
Type natural language like "Team meeting tomorrow at 3pm" and the AI will parse and create the event automatically.

### Workspace Collaboration
- Create workspaces for teams or families
- Invite members with unique join codes
- Manage permissions with role-based access
- Real-time event synchronization

### Smart Event Management
- Recurring events (daily, weekly, monthly, yearly)
- Color-coded events
- Event search and filtering
- Drag-and-drop (coming soon)

## Development

### Running in Development Mode

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

### Building for Production

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
npm run preview
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Author

**Alex Abraham**
- GitHub: [@alexabraham0504](https://github.com/alexabraham0504)

## Acknowledgments

- Firebase for backend infrastructure
- Astro for the frontend framework
- All open-source contributors

---

Made with ❤️ by Alex Abraham
