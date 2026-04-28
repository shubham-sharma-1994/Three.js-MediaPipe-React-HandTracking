# Three.js MediaPipe React Hand Tracking

A real-time hand tracking application built with React, Three.js, and Google's MediaPipe. This project detects and visualizes hand landmarks using your webcam, with support for 3D model overlay and skeleton visualization.

## ✨ Features

- **Real-time Hand Detection**: Uses MediaPipe Hands to detect hand landmarks from webcam feed
- **3D Visualization**: Renders hand skeleton in 3D space using Three.js
- **3D Model Support**: Load and display 3D models (GLTF format) positioned on hands
- **Skeleton Overlay**: Optional 2D skeleton visualization on canvas
- **Interactive Controls**: Toggle skeleton display, adjust model scale
- **Responsive Design**: Adapts to different screen sizes

## 🛠 Tech Stack

- **React 19**: UI framework
- **Vite**: Build tool and development server
- **Three.js**: 3D graphics library
- **MediaPipe Hands**: Hand detection and landmark tracking
- **GLTF Loader**: 3D model loading

## 📋 Prerequisites

- Node.js 16+ and npm/yarn
- Webcam access
- Modern browser with WebGL support

## 🚀 Getting Started

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd Three.js-MediaPipe-React-HandTracking

# Install dependencies
npm install
```

### Development

```bash
# Start the development server
npm run dev
```

The application will open at `http://localhost:5173` by default. Grant webcam permissions when prompted.

### Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## 📁 Project Structure

```
src/
├── App.jsx              # Main application component
├── App.css              # Application styles
├── main.jsx             # React entry point
├── index.css            # Global styles
└── assets/
    └── models/
        └── watch/       # 3D model assets (GLTF files)

public/
└── assets/
    └── models/
        └── watch/       # Additional model resources
```

## 🎮 Usage

1. **Allow Webcam Access**: Grant camera permissions when the application requests
2. **View Hand Detection**: The application automatically detects and displays hand landmarks in 3D
3. **Toggle Skeleton**: Use the UI controls to toggle 2D skeleton visualization
4. **Adjust Model**: Modify the watch scale multiplier to adjust 3D model size

## 🔧 Configuration

Key configuration options in [src/App.jsx](src/App.jsx):

- `watchScaleMultiplierRef`: Controls the scale of the 3D model (default: 4)
- `userOffsetRef`: Adjusts the model position relative to hand landmarks
- `HAND_CONNECTIONS`: Defines the skeleton joint connections

## 📚 API Reference

### Hand Landmarks
The application tracks 21 hand landmarks using MediaPipe:
- Wrist (0)
- Fingers: Thumb, Index, Middle, Ring, Pinky
- Each finger has 4 landmarks (base, mid, pip, tip)

### 3D Models
3D models should be in GLTF format and placed in `src/assets/models/`. Currently supports watch models.

## 🐛 Troubleshooting

- **Model not loading**: Verify GLTF files exist in `src/assets/models/watch/`
- **Webcam not detected**: Check browser permissions and camera availability
- **Poor hand tracking**: Ensure adequate lighting and clear hand visibility
- **Performance issues**: Lower renderer resolution or reduce hand detection frequency

## 💡 Development Notes

- Hot Module Reloading (HMR) is enabled for rapid development
- ESLint is configured for code quality checks
- Three.js is configured with alpha channel for transparent background overlay

## 🧪 Linting

```bash
# Run ESLint
npm run lint
```

## 📄 License

Add your license information here.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues, questions, or feature requests, please open an issue in the repository.
