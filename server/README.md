# TricycleMOD Server

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env` file in the server directory with the following variables:
   
   ```env
   MONGO_URI=mongodb+srv://hinakagiyamaa:<db_password>@ubheat.fgqil.mongodb.net/?retryWrites=true&w=majority&appName=UBheat
   JWT_SECRET=your_jwt_secret_key_here_change_this_in_production
   JWT_EXPIRE=7d
   PORT=5000
   ```

   **Important**: Replace `<db_password>` with your actual MongoDB password.

3. **Start the Server**
   ```bash
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user info

### User Profile
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `PUT /api/users/change-password` - Change password

## User Model

The User model includes the following fields:
- `email` (required, unique)
- `password` (required, hashed with bcrypt)
- `name` (required)
- `contactNumber` (required)
- `plateNumber` (required)
- `address` (optional)
- `operatorName` (optional)
- `driverPicture` (optional, URL)
- `role` (enum: 'driver' | 'operator', default: 'driver')

