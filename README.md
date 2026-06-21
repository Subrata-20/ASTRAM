# ASTRAM: AI-Powered Traffic Incident Management

![ASTRAM](https://img.shields.io/badge/Status-Active-brightgreen)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688)
![React](https://img.shields.io/badge/Frontend-React_Vite-61DAFB)
![Machine Learning](https://img.shields.io/badge/ML-XGBoost_%7C_Scikit--Learn-ff69b4)

**ASTRAM** is an intelligent, real-time traffic incident management system built specifically to tackle gridlock and optimize emergency response in Bengaluru. By leveraging Machine Learning and the Gemini AI API, ASTRAM proactively predicts the severity of accidents, estimates clearance duration, and automates alternate routing.

## 🚀 Key Features

* **Real-time Geospatial Dashboard:** Interactive Leaflet map displaying active incidents, impact radii, and required barricading types.
* **AI Prediction Engine:** Uses XGBoost and Random Forest models trained on historical Bengaluru traffic data to instantly predict Incident Priority and Clearance Duration.
* **Dynamic Burden Scoring:** Calculates a precise 0-100 "Burden Score" to help dispatchers allocate resources efficiently.
* **Automated Diversions:** Generates immediate alternate routing paths around affected sectors.
* **Advanced Analytics Suite:** Data dashboard tracking closure rates, historical incident volumes, and response bottlenecks with one-click CSV export functionality.
* **Live WebSockets:** Instant syncing across all operator screens without refreshing.

---

## 🏗️ Architecture

* **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React-Leaflet, Recharts, Lucide Icons.
* **Backend:** Python 3.10+, FastAPI, Uvicorn, Pandas.
* **Machine Learning:** Scikit-Learn, XGBoost, Google GenAI SDK (Gemini).

---

## ⚙️ Prerequisites

Before you begin, ensure you have met the following requirements:
* **Node.js** (v18.0.0 or higher)
* **Python** (v3.10.0 or higher)
* **Google Gemini API Key** (Required for the AI context generation)
* **OpenRouteService (ORS) API Key** (Required for generating diversion routes)

---

## 🛠️ Local Setup & Installation

### 1. Clone the repository
```bash
git clone https://github.com/Subrata-20/ASTRAM.git
cd ASTRAM
```

### 2. Backend Setup
Navigate to the backend directory, install dependencies, and set up your environment variables.

```bash
cd backend

# Create a virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate

# Install requirements
pip install -r requirements.txt

# Environment Variables
# Create a .env file in the /backend directory and add your API keys:
echo "GEMINI_API_KEY=your_gemini_api_key_here" > .env
echo "ORS_API_KEY=your_openrouteservice_api_key_here" >> .env
```

### 3. Frontend Setup
Navigate to the frontend directory and install the required npm packages.

```bash
cd ../frontend

# Install dependencies
npm install
```

---

## 🏃‍♂️ Running the Application Locally

You will need to run the Backend and the Frontend simultaneously in two different terminal windows.

### Start the Backend Server
```bash
cd backend
python main.py
```
*The backend will boot up, load the ML models, and bind to `http://localhost:8000`.*

### Start the Frontend Server
```bash
cd frontend
npm run dev
```
*The frontend will start and be accessible at `http://localhost:3000` or `http://localhost:5173`.*

---

## ☁️ Deployment

* **Frontend:** Deployed on [Vercel](https://astram-chi.vercel.app)
* **Backend:** Deployed on [Render](https://astram-oruw.onrender.com)
* **Dataset:** The historical data `astram_events.csv` is loaded dynamically on server start for analytics.

---

## 📜 License
This project is created for academic and demonstration purposes.
