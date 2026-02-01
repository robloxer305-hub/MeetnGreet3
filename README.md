# Meet&Greet

Text-only social chat platform with public rooms, friends, private messages, and random chat matching.

## Tech

- Backend: Node.js, Express, Socket.IO, MongoDB (Mongoose), JWT
- Frontend: React (Vite)

---

## Run locally

### 1) Backend environment

Create `server/.env`:

```
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/meetgreet
JWT_SECRET=replace_me_with_a_long_random_secret
CLIENT_ORIGIN=http://localhost:5173
```

### 2) Install dependencies

From repo root:

```
npm install
```

### 3) Start in dev mode

- Backend (and Socket.IO):

```
npm run dev
```

- Frontend:

```
npm --workspace client run dev
```

Open:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

---

## Deploy / Run on Replit

### Recommended (single public URL)

1. Set Replit Secrets / environment variables:

- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_ORIGIN` (set to your Replit app URL, e.g. `https://meet-greet.<yourname>.repl.co`)

2. Build the frontend:

```
npm run build
```

3. Start the server (serves the built React app + Socket.IO):

```
npm start
```

The backend serves the frontend from `client/dist` when it exists.

---

## Connecting frontend to backend URL

- In development, the React app uses `VITE_API_BASE_URL` and `VITE_SOCKET_URL` from `client/.env`.
- On Replit (production), you typically do not need these because the frontend is served by the same Express server.

Create `client/.env` (dev):

```
VITE_API_BASE_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```
