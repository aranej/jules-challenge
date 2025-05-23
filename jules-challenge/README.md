# Jules Brutálny Coding Challenge - Real-time Dashboard

## 1. Brief Description

This project is a real-time dashboard application designed to display streaming analytics. It features a backend server that handles data generation, WebSocket communication, authentication, and caching, along with a sophisticated frontend for data visualization. The system also includes error recovery mechanisms like circuit breakers and a stream processor for data aggregation.

## 2. Architecture Overview

The project is composed of the following main parts:

*   **Backend (`server.js` located in `jules-challenge/`)**:
    *   Built with Node.js and Express.js.
    *   Real-time communication via WebSockets (`ws` library).
    *   JWT (JSON Web Token) authentication for securing WebSocket connections and API endpoints.
    *   Redis integration for caching API data, with a fallback mechanism if Redis is unavailable.
    *   A built-in demo data generator that streams data points to connected clients.
    *   Environment configuration managed by `dotenv`.

*   **Frontend (`frontend-vite/` located in `jules-challenge/frontend-vite/`)**:
    *   Developed with React and TypeScript, built using Vite.
    *   Data visualization using D3.js for interactive line charts.
    *   WebSocket client to receive real-time data streams.
    *   JWT token input for authenticating WebSocket connections.
    *   IndexedDB for offline data caching, allowing the dashboard to display previously received data when offline.
    *   Responsive design for usability across different screen sizes (mobile, tablet, desktop).
    *   Automatic reconnection logic with exponential backoff for WebSocket connections.
    *   Vite dev server proxy configured for API and WebSocket requests to the backend.

*   **Stream Processor (`StreamProcessor.js` located in `jules-challenge/src/`)**:
    *   This module is part of the backend logic (though not directly instantiated in the current `server.js` which uses a simpler demo data generator).
    *   Designed for processing incoming event streams.
    *   Includes a Circuit Breaker pattern to handle errors during event processing and prevent cascading failures.
    *   Performs data aggregation over rolling time windows.
    *   Features enhanced event buffering capabilities, including manual control and buffer size limits.

## 3. Prerequisites

*   **For running services directly on your machine (Native Setup)**:
    *   **Node.js**: v18+ recommended (or v16+).
    *   **npm** (Node Package Manager, typically comes with Node.js).
    *   **Redis**: An instance of Redis server running (e.g., `localhost:6379`). The backend includes a fallback for the `/api/data` route if Redis is unavailable, but caching will be disabled.
*   **For running with Docker (Recommended for Ease of Use)**:
    *   **Docker Desktop** (or Docker Engine + Docker Compose CLI) installed.

## 4. Setup & Installation (Native / Non-Docker)

**Note:** For the simplest setup and to ensure all services (like Redis) are correctly networked, we recommend using the **Docker setup described in section 6**. These instructions are for running services directly on your machine.

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    ```
2.  **Navigate to the project root**:
    ```bash
    cd jules-challenge
    ```
3.  **Install backend dependencies**:
    ```bash
    npm install
    ```
4.  **Navigate to the frontend directory**:
    ```bash
    cd frontend-vite
    ```
5.  **Install frontend dependencies**:
    ```bash
    npm install
    ```
6.  **Go back to the project root directory**:
    ```bash
    cd ..
    ```

## 5. Environment Configuration (Native / Non-Docker)

**Note:** These instructions are for the native/non-Docker setup. For Docker, see section 6.1.

The backend server requires a `.env` file for configuration.

1.  Create a file named `.env` in the root of the `jules-challenge` directory (alongside `server.js` and `package.json`).
2.  Add the following content to the `.env` file, adjusting values as necessary:

    ```env
    PORT=3000
    JWT_SECRET=yourSuperSecretKeyForJWT_CHANGE_THIS_IN_PRODUCTION!
    REDIS_URL=redis://localhost:6379 
    ```
    *   `PORT`: The port on which the backend server will run.
    *   `JWT_SECRET`: A strong, random string used for signing and verifying JSON Web Tokens. **It is crucial to change this to a secure secret for any non-demo environment.**
    *   `REDIS_URL`: The connection string for your Redis server. For native setup, this should point to your locally running Redis instance.

## 6. Running with Docker (Recommended for Ease of Use)

This is the recommended way to run the application as it simplifies dependency management (like Redis) and ensures consistent environments.

### 6.1. Environment Configuration for Docker

1.  Ensure you have a `.env` file in the root of the `jules-challenge` directory (the same one used for native setup). The `docker-compose.yml` file is configured to pass this to the `backend` service.
2.  Content of `.env`:
    ```env
    PORT=3000
    JWT_SECRET=yourSuperSecretKeyForJWT_CHANGE_THIS_IN_PRODUCTION!
    # REDIS_URL=redis://localhost:6379 # This line is IGNORED by docker-compose
    ```
    *   `PORT`: The backend server will use this port *inside* its container. This is also used to map the host port.
    *   `JWT_SECRET`: Must be set for the backend to function correctly.
    *   **Important for `REDIS_URL`**: The `REDIS_URL` variable in your `.env` file is **ignored** when using `docker-compose.yml`. The `docker-compose.yml` file overrides this setting to `REDIS_URL: redis://redis:6379` to use Docker's internal network service name (`redis`) for communication between the backend and Redis containers.

### 6.2. Build and Run Docker Containers

1.  From the `jules-challenge` (root) directory:
2.  **Optional - Build images explicitly**:
    This step is usually only needed if you've made changes to `Dockerfile.backend`, `Dockerfile.frontend`, `nginx.conf`, or other files that affect the image layers directly. `docker-compose up` will build images automatically if they don't exist or if their context has changed.
    ```bash
    docker-compose build
    ```
3.  **Start all services**:
    ```bash
    docker-compose up
    ```
    To run in detached mode (in the background):
    ```bash
    docker-compose up -d
    ```

### 6.3. Accessing the Application

*   **Frontend (Dashboard)**: Open your browser and navigate to `http://localhost:8080` (this port is mapped to the frontend Nginx container in `docker-compose.yml`).
*   **Backend API / WebSockets**: The frontend at `http://localhost:8080` will automatically proxy API requests (e.g., `/api/...`, `/auth/...`) and WebSocket connections (`/ws`) to the backend service, thanks to the Nginx configuration within the frontend container. Direct access to the backend API for testing (e.g., via Postman) would also be through `http://localhost:8080/api/...` or `http://localhost:8080/auth/...`.

### 6.4. Viewing Logs

*   If running with `docker-compose up` (attached mode), logs from all services will be streamed to your terminal.
*   If running in detached mode (`-d`):
    *   To view logs for all services and follow them:
        ```bash
        docker-compose logs -f
        ```
    *   To view logs for a specific service (e.g., `backend`):
        ```bash
        docker-compose logs -f backend
        ```
        (Other service names: `frontend`, `redis`)

### 6.5. Stopping the Application

1.  If running in attached mode (logs in terminal), press `Ctrl+C`.
2.  From the `jules-challenge` (root) directory, run:
    ```bash
    docker-compose down
    ```
    This command stops and removes the containers and the network created by `docker-compose up`.
    *   To also remove named volumes (like `redis-data` which stores Redis persistence):
        ```bash
        docker-compose down -v
        ```

## 7. Running the Application (Native / Non-Docker Development)

**Note:** For the simplest setup and to ensure all services (like Redis) are correctly networked, we recommend using the Docker setup described in section 6.

To run both the backend server and the frontend Vite development server concurrently directly on your machine:

1.  Ensure you have a locally running Redis instance accessible via `redis://localhost:6379` (or as configured in your `.env` file for the `REDIS_URL` variable).
2.  Ensure you are in the `jules-challenge` (root) directory.
3.  Run the following command:
    ```bash
    npm run dev
    ```
    This command uses `concurrently` to start:
    *   The backend server (using `nodemon` for hot-reloading) typically on `http://localhost:3000` (or as specified by `PORT` in your `.env` file).
    *   The frontend Vite development server, typically available at `http://localhost:5173` (Vite will log the exact port to the console).

    Access the frontend by opening `http://localhost:5173` (or the logged port) in your browser.

## 8. Building the Frontend for Production (Native / Non-Docker)

To create a production-ready build of the frontend application:

1.  Ensure you are in the `jules-challenge` (root) directory.
2.  Run the command:
    ```bash
    npm run build:frontend-from-root
    ```
    This will execute the build process for the Vite frontend. The optimized static files will be generated in the `jules-challenge/frontend-vite/dist` directory. These files can then be served by any static file server or deployed to a hosting service.

## 9. Running Backend Separately (Native / Non-Docker)

From the `jules-challenge` (root) directory:

*   For development with automatic restarts on file changes:
    ```bash
    npm run dev:backend
    ```
*   For a simple start (e.g., for production or when hot-reloading is not needed):
    ```bash
    npm run start:backend
    ```

## 10. Running Frontend Separately (Native / Non-Docker)

1.  Navigate to the frontend directory:
    ```bash
    cd frontend-vite
    ```
2.  Available scripts:
    *   Start the Vite development server:
        ```bash
        npm run dev
        ```
    *   Build the frontend for production:
        ```bash
        npm run build
        ```
    *   Preview the production build locally:
        ```bash
        npm run preview
        ```
    *   (Remember to navigate back to the root `jules-challenge` directory with `cd ..` if you need to run root-level commands again.)

## 11. Notes on StreamProcessor.js

The `StreamProcessor.js` file located in `jules-challenge/src/` is part of the backend logic. While its advanced features (Circuit Breaker, data aggregation, event buffering) are designed for robust event stream processing, the current `server.js` uses a simplified internal demo data generator for streaming data to the frontend. The `StreamProcessor` module represents a more sophisticated processing layer that could be fully integrated if the backend were to consume external event sources or require more complex data handling before WebSocket distribution.
