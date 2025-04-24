# Gurt

Gurt is a desktop application designed to help users with technical coding interviews. It allows users to take screenshots of coding problems, process them using AI, and get solutions.

## Features

- Take screenshots of coding problems
- Process screenshots to extract problem statements
- Generate solutions in your preferred programming language
- View time and space complexity analysis
- Toggle window visibility with keyboard shortcuts
- Move the window around the screen with keyboard shortcuts

## Keyboard Shortcuts

- **Cmd/Ctrl + \\**: Toggle window visibility
- **Cmd/Ctrl + Q**: Quit the application
- **Cmd/Ctrl + Shift + \\**: Take a screenshot
- **Cmd/Ctrl + Enter**: Process screenshots
- **Arrow keys with Cmd/Ctrl**: Move window around the screen

## Running the Application

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:

   ```
   npm install
   # or
   yarn
   ```

2. Run the application in development mode:

   ```
   npm run dev
   # or
   yarn dev
   ```

3. Build the application for production:
   ```
   npm run build
   # or
   yarn build
   ```

## API Integration

This version of the application still requires an API connection to process screenshots and generate solutions. You'll need to set up your own API service or modify the code to use a different solution generation method.

## Disclaimer

This modified version is for educational purposes only. The original Gurt application is a commercial product with subscription requirements.

## License

This project is licensed under the ISC License.
