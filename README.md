# Vocab Quiz App

## Overview
The Vocab Quiz App is a web-based application designed to help users learn vocabulary through interactive quizzes. The application supports various quiz formats, including multiple-choice questions, matching exercises, and flashcards. Users can upload their vocabulary lists in Excel format, track their progress, and analyze their performance over time.

## Features
- **Interactive Quizzes**: Engage with vocabulary through multiple-choice questions, matching exercises, and flashcards.
- **Progress Tracking**: Visualize your learning journey with progress charts that display performance metrics.
- **Excel Integration**: Easily upload vocabulary lists from Excel files for use in quizzes.
- **Performance Analytics**: Access detailed analytics to monitor your learning progress and identify areas for improvement.

## Project Structure
```
vocab-quiz-app
├── src
│   ├── components          # Reusable components for the application
│   ├── pages               # Different pages of the application
│   ├── services            # Services for handling business logic
│   ├── stores              # State management for vocabulary lists and user progress
│   ├── types               # TypeScript types and interfaces
│   ├── utils               # Utility functions
│   ├── App.tsx             # Main application component
│   └── main.tsx            # Entry point of the application
├── public
│   └── index.html          # Main HTML file
├── package.json            # NPM configuration file
├── tsconfig.json           # TypeScript configuration file
└── vite.config.ts          # Vite configuration file
```

## Installation
1. Clone the repository:
   ```
   git clone https://github.com/yourusername/vocab-quiz-app.git
   ```
2. Navigate to the project directory:
   ```
   cd vocab-quiz-app
   ```
3. Install the dependencies:
   ```
   npm install
   ```

## Usage
To start the application, run:
```
npm run dev
```
Open your browser and navigate to `http://localhost:3000` to access the app.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.