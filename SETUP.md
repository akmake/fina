# Setup & Installation Guide

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- MongoDB (local or connection string)
- Docker & Docker Compose (optional)

## Local Development Setup

### Step 1: Clone & Install Dependencies
```bash
cd fina
npm run install-all
```

### Step 2: Configure Environment Variables

**Server Configuration:**
```bash
cp server/.env.example server/.env
```

Edit `server/.env` and set:
```env
# Critical - generate these!
JWT_ACCESS_SECRET=your_very_long_secret_min_32_chars_here_12345678
JWT_REFRESH_SECRET=your_very_long_refresh_secret_min_32_chars_12345678

# Database
MONGO_URI=mongodb://localhost:27017/fina
NODE_ENV=development
PORT=4000

# URLs
CLIENT_URL=http://localhost:5173
```

**Client Configuration:**
```bash
cp client/.env.example client/.env
```

Edit `client/.env`:
```env
VITE_API_URL=http://localhost:4000/api
VITE_DEBUG=true
```

### Step 3: Start Development Servers

```bash
npm run dev
```

This starts both:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:4000

### Step 4: Verify Setup

1. Open http://localhost:5173 in browser
2. Check browser console for any errors
3. Try logging in or registering
4. Check server logs for request logs

## 🐳 Docker Setup

### Prerequisites
- Docker installed
- Docker Compose installed

### Run with Docker
```bash
npm run docker:up
```

Access at http://localhost:5173

Stop containers:
```bash
npm run docker:down
```

## 🧪 Verification Checklist

- [ ] Both client and server are running
- [ ] No CORS errors in browser console
- [ ] Can access http://localhost:5173
- [ ] Can make API request to http://localhost:4000/api
- [ ] Logs are being written to `server/logs/`
- [ ] MongoDB is connected (check server logs)
- [ ] Can register a new user
- [ ] Can login successfully

## 🔧 Common Issues

### CORS Errors
```
ERROR: Not allowed by CORS
```
**Solution**: Verify `CLIENT_URL` in `.env` matches your actual client URL

### CSRF Token Missing
```
Form has been tampered with (CSRF Invalid)
```
**Solution**: Clear browser cookies and try again

### MongoDB Connection Failed
```
ERROR: MongoDB Connection Error: connect ECONNREFUSED
```
**Solution**: Ensure MongoDB is running on localhost:27017

### Port Already in Use
```
EADDRINUSE: address already in use :::4000
```
**Solution**: Change PORT in `.env` or kill process using port 4000

## 📊 Project Structure After Setup

```
fina/
├── client/
│   ├── .env (created)
│   ├── node_modules/
│   └── src/
├── server/
│   ├── .env (created)
│   ├── logs/ (created on first run)
│   ├── node_modules/
│   └── uploads/ (created on first upload)
├── node_modules/
└── package.json
```

## 🚢 Production deployment

Before deploying to production:

1. Create secure `.env` with production values
2. Set `NODE_ENV=production`
3. Run `npm run build` for client
4. Use `npm start` for server
5. Setup proper logging aggregation
6. Configure database backups
7. Enable HTTPS
8. Setup monitoring & alerts

## 📝 Next Steps

1. Read [API.md](../API.md) for API documentation
2. Check [IMPROVEMENTS.md](../IMPROVEMENTS.md) for recent changes
3. Run tests (once implemented)
4. Deploy to staging first

## ❓ Need Help?

- Check logs in `server/logs/`
- Review .env.example files
- Check API endpoint documentation
- Verify network connectivity
