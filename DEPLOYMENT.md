# 🚀 Deployment Instructions

## Backend Deployment (Render)

### 1. **Prepare Your Repository**
```bash
# Make sure all files are committed
git add .
git commit -m "Prepare for production deployment"
git push origin main
```

### 2. **Deploy to Render**
1. Go to [render.com](https://render.com) and sign up/login
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `soccer-prediction-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free` (or paid for better performance)

### 3. **Set Environment Variables in Render**
Go to your service → Environment tab and add:
```
NODE_ENV=production
MONGODB_URI=mongodb+srv://wanoarckaido:IKlOtl8D9bBEn1IR@soccer-prediction.aaekq3f.mongodb.net/soccer-prediction?retryWrites=true&w=majority&appName=Football-Prediction
ODDS_API_KEY=61f4311747f0fa551f5e701d0f24a21d
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
PORT=3000
```

### 4. **Get Your Backend URL**
After deployment, you'll get a URL like: `https://your-app-name.onrender.com`

---

## Frontend Deployment (Netlify)

### 1. **Update Frontend Configuration**
Edit `config.js` and replace the backend URL:
```javascript
API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'  // Development
  : 'https://your-render-app.onrender.com',  // Replace with your actual Render URL
```

### 2. **Deploy to Netlify**
1. Go to [netlify.com](https://netlify.com) and sign up/login
2. Drag and drop your project folder to Netlify dashboard
   OR
3. Connect your GitHub repository:
   - Click "New site from Git"
   - Choose GitHub and select your repository
   - Build settings:
     - **Build command**: Leave empty (static site)
     - **Publish directory**: `.` (current directory)

### 3. **Configure Custom Domain (Optional)**
1. Go to Site settings → Domain management
2. Add your custom domain
3. Update the CORS origins in your backend environment variables

---

## Important Updates Needed

### 1. **Update Backend CORS Origins**
In your Render environment variables, add your Netlify URL:
```
CORS_ORIGINS=https://your-netlify-app.netlify.app,https://your-custom-domain.com
```

### 2. **Update Frontend API URL**
In `config.js`, replace `your-render-app.onrender.com` with your actual Render URL.

### 3. **Test the Deployment**
1. Visit your Netlify frontend URL
2. Try to make a prediction
3. Check if the language switcher works
4. Verify all API calls are working

---

## Security Checklist

### Backend Security:
- ✅ Environment variables are set
- ✅ CORS is configured properly
- ✅ MongoDB connection is secure
- ⚠️ Change JWT_SECRET to a strong random string
- ⚠️ Change ADMIN_PASSWORD to a strong password

### Frontend Security:
- ✅ No sensitive data in frontend code
- ✅ API calls use HTTPS in production
- ✅ Netlify security headers are configured

---

## Monitoring & Maintenance

### Backend Monitoring:
- Check Render logs for errors
- Monitor MongoDB Atlas for database performance
- Set up uptime monitoring (optional)

### Frontend Monitoring:
- Check Netlify deploy logs
- Monitor site performance
- Test language switching functionality

---

## Troubleshooting

### Common Issues:

1. **CORS Errors**:
   - Update CORS_ORIGINS in Render environment variables
   - Include both HTTP and HTTPS versions if needed

2. **API Connection Failed**:
   - Verify the API_BASE_URL in config.js
   - Check if Render service is running
   - Check Render logs for backend errors

3. **Database Connection Issues**:
   - Verify MONGODB_URI is correct
   - Check MongoDB Atlas network access settings
   - Ensure database user has proper permissions

4. **Language Switching Not Working**:
   - Check browser console for JavaScript errors
   - Verify config.js is loaded properly
   - Clear browser cache and try again

---

## URLs After Deployment

- **Backend API**: `https://your-render-app.onrender.com`
- **Frontend**: `https://your-netlify-app.netlify.app`
- **Admin Panel**: `https://your-netlify-app.netlify.app/admin.html`
- **Results Page**: `https://your-netlify-app.netlify.app/results.html`

---

## Next Steps

1. Deploy backend to Render
2. Get the backend URL
3. Update config.js with the backend URL
4. Deploy frontend to Netlify
5. Test all functionality
6. Update environment variables if needed
7. Set up custom domains (optional)
8. Monitor and maintain the application

Good luck with your deployment! 🚀