const WebSocket = require("ws");

const webSocketUrl = "ws://localhost:5001/ws/websocket";
const defaultLocation = { lat: 36.8065, lon: 10.1815 };

const socket = new WebSocket(webSocketUrl);
const StompJs = require("@stomp/stompjs");

const client = new StompJs.Client({
  brokerURL: "ws://localhost:5001/ws/websocket",
  onConnect: () => {
    console.log("Connected to WebSocket server");

    const subscription = client.subscribe("/topic/location", (message) => {
      console.log("Received message:", message.body);
      try {
        const parsedMessage = JSON.parse(message.body);
        console.log("Parsed message:", parsedMessage);
      } catch (error) {
        console.log("Message is not a valid JSON");
      }
    });

    client.publish({
      destination: "/app/locate",
      body: JSON.stringify({
        lat: 36.8065,
        lon: 10.1815,
      }),
    });

    setInterval(moveTrain, 250);
  },
  onStompError: (frame) => {
    console.error("Broker reported error: " + frame.headers["message"]);
    console.error("Additional details: " + frame.body);
  },
  onWebSocketError: (error) => {
    console.error("WebSocket error:", error);
  },
});

function moveTrain() {
  const lat = defaultLocation.lat + 0.00001;

  const lon = defaultLocation.lon + 0.00001;
  defaultLocation.lat = lat;
  defaultLocation.lon = lon;
  client.publish({
    destination: "/app/locate",
    body: JSON.stringify({ lat, lon }),
  });
}
client.activate();
socket.addEventListener("open", function (event) {
  console.log("Connected to WebSocket server");

  socket.send(
    JSON.stringify({
      destination: "/app/locate",
      content: "Hello from Node.js client",
    })
  );
});

socket.addEventListener("message", (event) => {
  console.log("Message from server ", event.data);
});

socket.addEventListener("close", function (event) {
  console.log("Disconnected from WebSocket server");
});

socket.addEventListener("error", function (error) {
  console.error("WebSocket error:", error);
});
