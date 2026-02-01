# 🚀 Deploy Meet&Greet as 24/7 Free Site

## Option 1: Render (Recommended - Easiest)

1. **Create Free MongoDB Atlas Database**
   - Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Create free account
   - Create new cluster (M0 Sandbox - Free)
   - Get connection string

2. **Deploy to Render**
   - Go to [Render](https://render.com)
   - Connect your GitHub repo
   - Create "Web Service"
   - Use the `render.yaml` file I created
   - Set environment variables:
     ```
     MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/meetgreet
     JWT_SECRET=your_long_random_secret_here
     CLIENT_ORIGIN=https://your-app-name.onrender.com
     ```

3. **Automatic Deployment**
   - Render will build and deploy automatically
   - Your app will be live at `https://your-app-name.onrender.com`

## Option 2: Vercel (Frontend) + Render (Backend)

1. **Frontend on Vercel**
   - Go to [Vercel](https://vercel.com)
   - Import your repo
   - Use `vercel.json` configuration

2. **Backend on Render**
   - Deploy only the server folder to Render
   - Set `CLIENT_ORIGIN` to your Vercel URL

## Option 3: Replit (All-in-One)

1. **Import to Replit**
   - Go to [Replit](https://replit.com)
   - Import from GitHub
   - Set environment variables in Secrets tab
   - Run `npm run build && npm start`

## Environment Variables Needed

Copy these to your hosting platform:

```
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=generate_a_long_random_secret
CLIENT_ORIGIN=your_deployed_app_url
PORT=10000 (for Render) or 3001 (default)
```

## Generate JWT Secret

Run this command to generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Free Tier Limits

- **Render**: 750 hours/month (enough for 24/7)
- **MongoDB Atlas**: 512MB storage
- **Vercel**: 100GB bandwidth/month

Your app will stay online 24/7 within these free limits!
