module.exports = {
  webSocketUrl: "ws://localhost:5001/ws/websocket",
  initialLocation: {
    lat: 36.8065,
    lon: 10.1815,
  },
  updateInterval: 1000, // Base update interval in milliseconds
  maxReconnectAttempts: 5,
  trainsConfig: {
    colors: [
      "#FF5722",
      "#4CAF50",
      "#2196F3",
      "#9C27B0",
      "#FFC107",
      "#F44336",
      "#3F51B5",
      "#009688",
    ],
    defaultSpeed: 1.0,
    fastSpeed: 1.5,
    slowSpeed: 0.7,
  },
};
