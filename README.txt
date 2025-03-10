# NORMA AI

## Italian Law Compliance Management Tool

NORMA AI is a web application for managing Italian law compliance. It allows users to upload documents, analyze them for compliance with Italian laws, and stay updated on legal changes.

## Features

- User Registration and Authentication
- Document Upload and Management
- Compliance Analysis
- Legal Updates via RSS Feed
- Comprehensive Reporting

## Project Structure

The project is divided into two main parts:

- **Backend**: Flask application with PostgreSQL database
- **Frontend**: React application with Bootstrap styling

## Prerequisites

- Python 3.9+
- Node.js 16+
- PostgreSQL 14+

## Installation and Setup

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd norma_ai_backend
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   ```

3. Activate the virtual environment:
   - On Windows: `venv\Scripts\activate`
   - On macOS/Linux: `source venv/bin/activate`

4. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

5. Set up the database:
   ```
   flask db init
   flask db migrate -m "Initial migration"
   flask db upgrade
   ```

6. Run the application:
   ```
   flask run
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd norma_ai_frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Run the application:
   ```
   npm start
   ```

## Usage

1. Register a new user account
2. Log in with your credentials
3. Upload documents for compliance analysis
4. View the analysis results and compliance reports
5. Stay updated with the latest Italian legal changes

## License

This project is proprietary software. All rights reserved.

## Contact

For support or questions, please contact support@norma-ai.it
