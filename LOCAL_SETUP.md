# Local Development Setup Guide

## Overview
This guide will help you set up the OPSP Strategy App for local development. The application uses PostgreSQL as its database and requires proper configuration to run.

## Prerequisites
- Node.js 20+ installed
- PostgreSQL database (local or cloud)
- npm or yarn package manager

## Database Setup Options

### Option 1: Local PostgreSQL Installation

#### macOS (using Homebrew)
```bash
# Install PostgreSQL
brew install postgresql@16

# Start PostgreSQL service
brew services start postgresql@16

# Create database
createdb opsp_builder

# Create user (optional)
psql opsp_builder
CREATE USER opsp_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE opsp_builder TO opsp_user;
\q
```

#### Update .env file
```env
DATABASE_URL="postgresql://opsp_user:your_password@localhost:5432/opsp_builder"
```

### Option 2: Docker PostgreSQL
```bash
# Run PostgreSQL in Docker
docker run --name opsp-postgres \
  -e POSTGRES_DB=opsp_builder \
  -e POSTGRES_USER=opsp_user \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  -d postgres:16

# Update .env file
DATABASE_URL="postgresql://opsp_user:your_password@localhost:5432/opsp_builder"
```

### Option 3: Cloud Database (Neon, Supabase, etc.)
1. Sign up for a cloud PostgreSQL service
2. Create a new database
3. Copy the connection string
4. Update .env file with the connection string

## Installation Steps

1. **Clone and navigate to the project**
   ```bash
   cd /Users/brennangerle/Desktop/Development/OPSP-Builder
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   - Copy the provided .env file
   - Update DATABASE_URL with your database connection string
   - Optionally update other variables as needed

4. **Run database migrations**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

## Application Structure

- **Frontend**: React + TypeScript + Vite (port 5173)
- **Backend**: Express.js + TypeScript (port 5000)
- **Database**: PostgreSQL with Drizzle ORM
- **UI**: Tailwind CSS + Radix UI + Shadcn/ui

## Key Features

- Interactive OPSP canvas with real-time editing
- Priority and capability management
- Rocks tracking with detailed fields
- SWOT analysis
- KPI dashboard
- Agile Growth Checklist (35 items across 7 attributes)
- User authentication and role-based access

## Development Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - TypeScript type checking
- `npm run db:push` - Push database schema changes

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Verify DATABASE_URL in .env file
- Check firewall settings
- Verify database credentials

### Port Conflicts
- Backend runs on port 5000
- Frontend runs on port 5173
- Update PORT in .env if needed

### Dependencies Issues
- Delete node_modules and package-lock.json
- Run `npm install` again
- Check Node.js version compatibility

## Company Configuration

The application is pre-configured with Company ID: `200c32ef-28fe-4fa7-995d-96386671e89e` (Small Giants)

## Next Steps

1. Set up your database using one of the options above
2. Update the .env file with your database connection string
3. Run `npm run db:push` to create the database schema
4. Run `npm run dev` to start the application
5. Open http://localhost:5173 in your browser

## Support

If you encounter issues:
1. Check the console logs for error messages
2. Verify all environment variables are set correctly
3. Ensure PostgreSQL is running and accessible
4. Check that all dependencies are installed correctly
