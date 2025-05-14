const StompJs = require("@stomp/stompjs");
const config = require("./config.js");

class Train {
  constructor(id, name, lat, lon, color, departurePlace, destinationPlace) {
    this.id = id;
    this.name = name;
    this.lat = lat;
    this.lon = lon;
    this.color = color;
    this.departurePlace = departurePlace;
    this.destinationPlace = destinationPlace;
  }
}

class TrainSimulator {
  constructor() {
    this.trains = [];

    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  init() {
    this.setupStompClient();
  }

  setupStompClient() {
    this.client = new StompJs.Client({
      brokerURL: config.webSocketUrl,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: this.handleConnect.bind(this),
      onStompError: this.handleStompError.bind(this),
      onWebSocketError: this.handleWebSocketError.bind(this),
    });
  }

  handleConnect() {
    console.log("Connected to WebSocket server");
    this.isConnected = true;
    this.reconnectAttempts = 0;

    // Fetch trains from the backend first, then subscribe to topics and start simulation
    this.getAlltrains()
      .then(() => {
        this.subscribeToTopics();

        // Only start simulation if trains are available
        if (this.trains && this.trains.length > 0) {
          // Add speedFactor to each train if not already present
          this.trains.forEach((train) => {
            if (!train.lat) train.lat = config.initialLocation.lat;
            if (!train.lon) train.lon = config.initialLocation.lon;
            if (!train.speedFactor)
              train.speedFactor = config.trainsConfig.defaultSpeed;
          });

          this.startSimulation();
        } else {
          console.warn("No trains available for simulation");
        }
      })
      .catch((error) => {
        console.error("Failed to start simulation:", error);
      });
  }

  getAlltrains() {
    const URL = "http://localhost:5001/train/getAllTrains";
    return fetch(URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        this.trains = data;
        console.log("All trains:", this.trains);
        return data;
      })
      .catch((error) => {
        console.error("Error fetching trains:", error);
        // Create default trains if fetching fails
        this.createDefaultTrains();
        return this.trains;
      });
  }

  // Create some default trains in case the API call fails
  createDefaultTrains() {
    this.trains = [
      {
        id: 1,
        name: "Express Train",
        lat: 36.8065,
        lon: 10.1815,
        color: "#FF5722",
        speedFactor: 1.5,
        departurePlace: "Tunis",
        destinationPlace: "Sousse",
      },
      {
        id: 2,
        name: "Local Train",
        lat: 36.8165,
        lon: 10.1715,
        color: "#4CAF50",
        speedFactor: 1.0,
        departurePlace: "Bizerte",
        destinationPlace: "Tunis",
      },
      {
        id: 3,
        name: "Cargo Train",
        lat: 36.7965,
        lon: 10.1915,
        color: "#2196F3",
        speedFactor: 0.7,
        departurePlace: "Sfax",
        destinationPlace: "Tunis",
      },
    ];
    console.log("Created default trains as fallback");
  }

  subscribeToTopics() {
    // Subscribe to individual train locations
    this.client.subscribe(
      "/topic/location",
      this.handleLocationMessage.bind(this)
    );

    // Also subscribe to the trains topic for bulk updates
    this.client.subscribe("/topic/trains", this.handleTrainsMessage.bind(this));
  }

  handleLocationMessage(message) {
    try {
      const location = JSON.parse(message.body);
      console.log("Current train location:", location);
    } catch (error) {
      console.error("Error parsing location message:", error);
    }
  }

  handleTrainsMessage(message) {
    try {
      const trains = JSON.parse(message.body);
      console.log("Received trains data:", trains);
    } catch (error) {
      console.error("Error parsing trains message:", error);
    }
  }

  startSimulation() {
    console.log("Starting simulation with", this.trains.length, "trains");

    // Update each train at different intervals to simulate varying speeds
    this.trains.forEach((train) => {
      const updateInterval = Math.floor(
        config.updateInterval / train.speedFactor
      );

      setInterval(() => {
        this.moveTrain(train);
      }, updateInterval);
    });

    // Additionally, periodically send all trains together if needed
    setInterval(() => {
      this.sendAllTrains();
    }, 2000);
  }

  moveTrain(train) {
    if (!this.isConnected) return;

    // Add some randomness to the movement but maintain general direction
    const randomFactor = Math.random() * 0.00005 - 0.000025;
    const directionNoise = Math.random() * 0.00001;

    // Create a slightly different path for each train
    const latChange = 0.00001 * train.speedFactor + randomFactor;
    const lonChange = 0.00001 * train.speedFactor + directionNoise;

    train.lat += latChange;
    train.lon += lonChange;

    this.sendLocation(train);
  }

  sendAllTrains() {
    if (!this.isConnected) return;

    try {
      this.client.publish({
        destination: "/app/locate-json",
        body: JSON.stringify(this.trains),
      });
    } catch (error) {
      console.error("Error sending all trains:", error);
    }
  }

  sendLocation(train) {
    try {
      this.client.publish({
        destination: "/app/locate",
        body: JSON.stringify({
          id: train.id,
          name: train.name,
          lat: train.lat,
          lon: train.lon,
          color: train.color,
          departurePlace: train.departurePlace,
          destinationPlace: train.destinationPlace,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error("Error sending location:", error);
    }
  }

  handleStompError(frame) {
    console.error("Broker reported error:", frame.headers["message"]);
    this.handleReconnect();
  }

  handleWebSocketError(error) {
    console.error("WebSocket error:", error);
    this.handleReconnect();
  }

  handleReconnect() {
    this.isConnected = false;
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`
      );

      setTimeout(() => {
        this.client.activate();
      }, 5000 * this.reconnectAttempts); // Exponential backoff
    } else {
      console.error(
        `Failed to reconnect after ${this.maxReconnectAttempts} attempts.`
      );
    }
  }

  start() {
    this.client.activate();
  }
}

// Create and start the simulator
const simulator = new TrainSimulator();
simulator.init();
simulator.start();
