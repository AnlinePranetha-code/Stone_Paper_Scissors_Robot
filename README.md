# Robo Stone Paper Scissors 🤖💗

A cute Computer Vision Stone-Paper-Scissors game using a webcam and MediaPipe Hands.

## Features

- Real-time hand tracking
- Rock / Paper / Scissors recognition
- 3-2-1 countdown
- Random robot move
- Real-time score
- 5-round game
- Cute robot chat with preset responses
- Robot emotion/status messages
- Pink glitter-style UI
- Final scoreboard

## Project structure

```text
StonePaperScissors_Robot/
│
├── app.py
├── requirements.txt
├── README.md
│
├── templates/
│   └── index.html
│
└── static/
    ├── style.css
    ├── script.js
    └── images/
        └── robot.png
```

## Run

```bash
python -m venv venv
```

Windows:

```bash
venv\Scripts\activate
```

Install:

```bash
pip install -r requirements.txt
```

Start:

```bash
python app.py
```

Open:

```text
http://127.0.0.1:5000
```

Allow camera access.

## Computer Vision pipeline

```text
Webcam
   ↓
MediaPipe Hands
   ↓
21 hand landmarks
   ↓
Finger-state rules
   ↓
ROCK / PAPER / SCISSORS
   ↓
Game engine
   ↓
Score + Robot response
```

The hand classifier is intentionally rule-based and explainable:

- Rock = 0 extended non-thumb fingers
- Paper = 4 extended non-thumb fingers
- Scissors = index + middle extended, ring + pinky folded

## Important

The browser needs internet access because MediaPipe is loaded from jsDelivr CDN.

Camera access works on `localhost` / `127.0.0.1` in supported browsers.

For a college demo, use good lighting and keep one hand clearly visible inside the camera frame.
