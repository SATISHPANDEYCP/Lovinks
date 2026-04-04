# Chat App

Full-stack real-time chat application with authentication, profile uploads, and live messaging.

## Project Overview

This repository has two runnable apps:

- backend: Node.js + Express + MongoDB + Socket.IO API
- frontend: React + Vite + Tailwind client app

The root package file was intentionally removed, so run commands from backend and frontend folders directly.

## Features

- User signup, login, logout (JWT in httpOnly cookie)
- Auth-protected API routes
- Profile image upload via Cloudinary
- One-to-one messaging with text and optional image
- Real-time incoming messages using Socket.IO
- Online users indicator in sidebar
- Theme toggle with 3 themes: pastel, luxury, retro
- Default theme fallback: luxury

## Tech Stack

### Backend

- Node.js, Express
- MongoDB + Mongoose
- Socket.IO
- JWT auth + cookie-parser
- Cloudinary image uploads

### Frontend

- React 18 + Vite
- Zustand state management
- Axios
- Socket.IO client
- Tailwind CSS with manual theme tokens (no DaisyUI)

## Folder Structure

- backend/src/controllers: auth and message controllers
- backend/src/routes: API route definitions
- backend/src/middleware: auth middleware
- backend/src/lib: db, socket, cloudinary, jwt utils
- frontend/src/components: UI components
- frontend/src/pages: app pages
- frontend/src/store: Zustand stores
- frontend/src/lib: axios and utilities

## Prerequisites

- Node.js 18+
- npm 9+
- MongoDB connection string
- Cloudinary account

## Environment Variables

Create backend/.env with at least:

PORT=5001
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
NODE_ENV=development

## Run Locally

Open two terminals.

### 1) Start backend

cd backend
npm install
npm run dev

### 2) Start frontend

cd frontend
npm install
npm run dev

Frontend runs on http://localhost:5173 and backend on http://localhost:5001 by default.

## Build Frontend

cd frontend
npm run build
npm run preview

## API Base

In development, frontend uses:

- http://localhost:5001/api

In production, frontend uses:

- /api

## Main API Routes

### Auth

- POST /api/auth/signup
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/check
- PUT /api/auth/update-profile

### Messages

- GET /api/messages/users
- GET /api/messages/:id
- POST /api/messages/send/:id

## Notes

- CORS is currently configured for http://localhost:5173 in backend/src/index.js.
- If you deploy, update origin and environment variables accordingly.
- Since root package.json is removed, deployment should point to backend or use platform-specific build/start commands.
