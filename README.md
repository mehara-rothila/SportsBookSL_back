# SportsBookSL Backend

Sports Facility Booking Platform API - Sri Lanka

## 📋 Overview

The backend for SportsBookSL, a comprehensive sports facility booking platform for Sri Lanka. This server provides APIs for user authentication, facility bookings, trainer management, financial aid applications, donations, and more.

## ✨ Features

- **Comprehensive REST API**: Full API support for all platform features
- **Authentication System**: JWT-based secure authentication
- **File Upload**: Support for uploading profile pictures, facility images, and documents
- **Email Notifications**: Automated email notifications for various events
- **Database Integration**: MongoDB integration with Mongoose ODM
- **Weather API Integration**: External weather data integration with AI analysis
- **Error Handling**: Robust error handling and reporting
- **Middleware**: Custom middleware for authentication, error handling, and file uploads

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **File Storage**: Local file system (with cloud storage options available)
- **Email Service**: Brevo SMTP

## 📁 Project Structure

```
SportsBookSL-back/
├── config/                # Configuration files
│   └── db.js             # Database connection
├── controllers/          # Request handlers
│   ├── adminController.js
│   ├── athleteController.js
│   ├── authController.js
│   ├── bookingController.js
│   ├── categoryController.js
│   ├── donationController.js
│   ├── facilityController.js
│   ├── financialAidController.js
│   ├── notificationController.js
│   ├── reviewController.js
│   ├── testimonialController.js
│   ├── trainerApplicationController.js
│   ├── trainerController.js
│   ├── userController.js
│   ├── utilityController.js
│   └── weatherController.js
├── middleware/           # Express middleware
│   ├── authMiddleware.js  # Authentication middleware
│   ├── errorMiddleware.js # Error handling middleware
│   ├── uploadMiddleware.js # File upload middleware
│   └── urlTransformMiddleware.js # URL transformation middleware
├── models/               # Mongoose data models
│   ├── Athlete.js
│   ├── Booking.js
│   ├── Category.js
│   ├── Donation.js
│   ├── Facility.js
│   ├── FinancialAidApplication.js
│   ├── Notification.js
│   ├── Review.js
│   ├── Testimonial.js
│   ├── Trainer.js
│   ├── TrainerApplication.js
│   └── User.js
├── public/               # Public assets and uploads
│   └── uploads/          # Uploaded files
│       ├── athletes/
│       ├── avatars/
│       ├── categories/
│       ├── facilities/
│       ├── financial_aid_docs/
│       ├── testimonials/
│       └── trainers/
├── routes/               # API routes
│   ├── api/              # API route definitions
│   │   ├── admin.js
│   │   ├── athletes.js
│   │   ├── auth.js
│   │   ├── bookings.js
│   │   ├── categories.js
│   │   ├── donations.js
│   │   ├── facilities.js
│   │   ├── financialAid.js
│   │   ├── notifications.js
│   │   ├── reviews.js
│   │   ├── testimonials.js
│   │   ├── trainerApplications.js
│   │   ├── trainers.js
│   │   ├── users.js
│   │   ├── utils.js
│   │   └── weather.js
│   └── index.js          # Route aggregation
├── utils/                # Utility functions
│   ├── createNotification.js
│   └── sendEmail.js
├── .env                  # Environment variables
├── package.json          # Project dependencies
└── server.js             # Main server entry point
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v14.0.0 or later)
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/mehara-rothila/SportsBookSL_back.git
   cd SportsBookSL_back
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   NODE_ENV=development
   PORT=5001
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRE=30d
   SMTP_USER=your_smtp_username
   SMTP_PASSWORD=your_smtp_password
   EMAIL_FROM="Your Name <your_email@example.com>"
   ```

### Running the Server

```bash
npm start
# or
yarn start
```

For development with hot reload:
```bash
npm run dev
# or
yarn dev
```

The server will run on the port specified in your `.env` file (default: 5001) and will be accessible at [http://localhost:5001](http://localhost:5001).

## 🌦️ Weather Integration with AI Analysis

The backend includes a powerful weather analysis system that works in conjunction with the frontend's AI-powered weather assistant:

1. **Data Collection**: The `weatherController.js` retrieves weather data from OpenWeather API
2. **Data Processing**: Weather data is processed and analyzed
3. **AI Integration**: Processed data is sent to Google's Gemini AI via the frontend for more advanced analysis
4. **Intelligent Recommendations**: The system provides facility-specific recommendations based on:
   - Current and forecasted weather conditions
   - Sport type requirements
   - Facility specifications

This integration helps users make informed decisions about bookings and suggests suitable alternatives when weather conditions are unfavorable for outdoor activities.

## 📝 API Documentation

### Authentication Endpoints

| Endpoint | Method | Description | Authentication Required |
|----------|--------|-------------|------------------------|
| `/api/auth/register` | POST | Register a new user | No |
| `/api/auth/login` | POST | User login | No |
| `/api/auth/me` | GET | Get current user profile | Yes |
| `/api/auth/forgotpassword` | POST | Request password reset | No |
| `/api/auth/resetpassword` | PUT | Reset password with OTP | No |

### Facility Endpoints

| Endpoint | Method | Description | Authentication Required |
|----------|--------|-------------|------------------------|
| `/api/facilities` | GET | Get all facilities | No |
| `/api/facilities/featured` | GET | Get featured facilities | No |
| `/api/facilities/:id` | GET | Get a single facility | No |
| `/api/facilities` | POST | Create a new facility | Yes (Admin) |
| `/api/facilities/:id` | PUT | Update a facility | Yes (Admin) |
| `/api/facilities/:id` | DELETE | Delete a facility | Yes (Admin) |

### Booking Endpoints

| Endpoint | Method | Description | Authentication Required |
|----------|--------|-------------|------------------------|
| `/api/bookings` | GET | Get user's bookings | Yes |
| `/api/bookings` | POST | Create a new booking | Yes |
| `/api/bookings/:id` | GET | Get booking details | Yes |
| `/api/bookings/:id/status` | PUT | Update booking status | Yes (Admin) |
| `/api/bookings/:id` | DELETE | Cancel a booking | Yes |

### Trainer Endpoints

| Endpoint | Method | Description | Authentication Required |
|----------|--------|-------------|------------------------|
| `/api/trainers` | GET | Get all trainers | No |
| `/api/trainers/:id` | GET | Get a single trainer | No |
| `/api/trainers` | POST | Create a new trainer | Yes (Admin) |
| `/api/trainers/:id` | PUT | Update a trainer | Yes (Admin) |
| `/api/trainers/:id` | DELETE | Delete a trainer | Yes (Admin) |

### Donation Endpoints

| Endpoint | Method | Description | Authentication Required |
|----------|--------|-------------|------------------------|
| `/api/donations` | GET | Get all donations | No |
| `/api/donations` | POST | Create a new donation | Yes |
| `/api/donations/:id` | GET | Get donation details | No |

### Financial Aid Endpoints

| Endpoint | Method | Description | Authentication Required |
|----------|--------|-------------|------------------------|
| `/api/financialAid` | POST | Apply for financial aid | Yes |
| `/api/financialAid` | GET | Get user's applications | Yes |
| `/api/financialAid/:id/status` | PUT | Update application status | Yes (Admin) |

### Weather Endpoints

| Endpoint | Method | Description | Authentication Required |
|----------|--------|-------------|------------------------|
| `/api/weather/current/:facilityId` | GET | Get current weather for a facility | No |
| `/api/weather/forecast/:facilityId` | GET | Get weather forecast for a facility | No |
| `/api/weather/recommendation/:facilityId` | GET | Get booking recommendation | No |

## 🔐 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| NODE_ENV | Environment mode | development |
| PORT | Server port | 5001 |
| MONGO_URI | MongoDB connection string | [Your MongoDB Connection String] |
| JWT_SECRET | Secret key for JWT | [Your JWT Secret Key] |
| JWT_EXPIRE | JWT token expiration | 30d |
| SMTP_USER | SMTP username | [Your SMTP Username] |
| SMTP_PASSWORD | SMTP password | [Your SMTP Password] |
| EMAIL_FROM | Sender email address | "Your Name <your_email@example.com>" |

## 👥 Team Members

**Team Name: Xforce**

- **Mehara Rothila** - Team Leader
- **Aditha Buwaneka**
- **Dinith Edirisinghe**
- **Piyumi Imasha**

## 📄 License

This project is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.
