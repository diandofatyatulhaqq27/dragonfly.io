# Industrial IoT (IIoT) Web Dashboard

[![Framework](https://img.shields.io/badge/Framework-Next.js%2014-blue?style=flat-square&logo=nextdotjs)](https://nextjs.org/)
[![Library](https://img.shields.io/badge/Library-React-61dafb?style=flat-square&logo=react)](https://reactjs.org/)
[![Status](https://img.shields.io/badge/Project-PKL%20%2F%20Internship-orange?style=flat-square)]()

A web-based *Industrial Internet of Things* (IIoT) dashboard application designed to monitor industrial automation systems and connected field devices in real-time. This project was developed as part of the practical field project (PKL) / internship curriculum requirement for the university degree.

## 🚀 Key Features

* **Real-time Sensor Monitoring:** Live data visualization of industrial sensors, including the Cosmos KD-12B Gas Sensor Analog Input, Air Handling Unit (AHU) statuses, and ventilation ducting metrics.
* **Interactive SVG Widgets:** The dashboard utilizes custom *Scalable Vector Graphics* (SVG) widgets to deliver dynamic, high-resolution, and lightweight visual status indicators that scale smoothly across devices.
* **Smart Alarm System:** A responsive telemetry alarm infrastructure. It incorporates a safety-first data handling logic: if no data is received (null/empty payload), the status defaults to `0` to prevent accidental false alarms.
* **Localized Interface:** The system interface has been fully localized into Indonesian for on-site technical clarity (e.g., translating critical systems like *Fire Suppression System* into *Sistem Pemadam Kebakaran*).

## 🛠️ Tech Stack

* **Frontend Framework:** Next.js (React)
* **Routing & State Management:** Next.js App Router & React Hooks (`useState`, `useEffect`)
* **Styling:** Tailwind CSS / CSS Modules
* **Database & Integration:** PostgreSQL (Supabase/Render) / Node.js API
* **Deployment Architecture:** GitHub Private Repository paired with cloud hosting platforms (Vercel / AWS EC2 via Git workflow)

---

## 💻 Local Development Setup

Prerequisites: Ensure **Node.js** (v18 or higher) and **Git** are installed on your machine.

1.  **Clone the Private Repository:**
    ```bash
    git clone [https://github.com/your-username/iiot-dashboard-repo.git](https://github.com/your-username/iiot-dashboard-repo.git)
    cd iiot-dashboard-repo
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env.local` file in the root directory and add the required API or database credentials:
    ```env
    NEXT_PUBLIC_API_URL=http://localhost:3000/api
    # Add external database or telemetry stream configs here
    ```

4.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## 🗂️ Project Directory Structure

```text
├── .next/                  # Automated Next.js build outputs
├── node_modules/           # Third-party dependencies
├── src/
│   ├── app/                # Next.js App Router (Pages layout)
│   │   ├── page.js         # Main Dashboard landing page
│   │   └── sensor/         # SensorDetailPage feature module
│   ├── components/         # Reusable SVG Widgets & Alarm UI components
│   └── utils/              # Helper functions & API connection configurations
├── .gitignore              # Files excluded from Git tracking
├── package.json            # Project manifest and npm scripts
└── README.md               # Project documentation
