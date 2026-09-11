const TOTAL_ROUNDS = 5;

// -----------------------------
// DOM
// -----------------------------
const video = document.getElementById("inputVideo");
const canvas = document.getElementById("outputCanvas");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("startBtn");
const playAgainBtn = document.getElementById("playAgainBtn");

const cameraOverlay = document.getElementById("cameraOverlay");
const cameraStatus = document.getElementById("cameraStatus");
const liveDot = document.querySelector(".live-dot");

const detectedGesture = document.getElementById("detectedGesture");
const countdownCard = document.getElementById("countdownCard");
const countdownText = document.getElementById("countdownText");
const countdownHint = document.getElementById("countdownHint");

const robotMoveEl = document.getElementById("robotMove");
const robotWrap = document.getElementById("robotWrap");
const emotionBadge = document.getElementById("emotionBadge");

const speechBubble = document.getElementById("speechBubble");
const speechText = document.getElementById("speechText");

const roundText = document.getElementById("roundText");
const robotScoreEl = document.getElementById("robotScore");
const userScoreEl = document.getElementById("userScore");
const drawScoreEl = document.getElementById("drawScore");

const resultModal = document.getElementById("resultModal");
const resultEmoji = document.getElementById("resultEmoji");
const resultTitle = document.getElementById("resultTitle");
const resultMessage = document.getElementById("resultMessage");
const finalRobotScore = document.getElementById("finalRobotScore");
const finalUserScore = document.getElementById("finalUserScore");
const finalRounds = document.getElementById("finalRounds");
const finalDraws = document.getElementById("finalDraws");
const confetti = document.getElementById("confetti");

const chatInput = document.getElementById("chatInput");
const chatBtn = document.getElementById("chatBtn");

// -----------------------------
// Game state
// -----------------------------
let gameRunning = false;
let cameraStarted = false;
let currentRound = 0;

let userScore = 0;
let robotScore = 0;
let drawScore = 0;

let latestGesture = null;
let stableGesture = null;
let gestureHistory = [];
let processingFrame = false;

const moves = ["ROCK", "PAPER", "SCISSORS"];

// -----------------------------
// MediaPipe Hands
// -----------------------------
const hands = new Hands({
    locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.65,
    minTrackingConfidence: 0.65
});

hands.onResults(onHandResults);

async function startCamera() {
    if (cameraStarted) return true;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 960 },
                height: { ideal: 540 },
                facingMode: "user"
            },
            audio: false
        });

        video.srcObject = stream;
        await video.play();

        cameraStarted = true;
        cameraOverlay.classList.add("hidden");
        cameraStatus.textContent = "Camera ready";
        liveDot.classList.add("active");

        requestAnimationFrame(processCameraFrame);
        return true;
    } catch (error) {
        console.error(error);
        cameraStatus.textContent = "Camera permission needed";
        setRobotMessage("I can't see your hand yet 🥺 Please allow camera access!");
        return false;
    }
}

async function processCameraFrame() {
    if (!cameraStarted) return;

    if (!processingFrame && video.readyState >= 2) {
        processingFrame = true;

        try {
            if (canvas.width !== video.videoWidth) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            }

            await hands.send({ image: video });
        } catch (error) {
            console.error("MediaPipe frame error:", error);
        } finally {
            processingFrame = false;
        }
    }

    requestAnimationFrame(processCameraFrame);
}

function onHandResults(results) {
    if (!canvas.width || !canvas.height) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Mirror the landmark drawing so it matches the mirrored webcam.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
            color: "rgba(255, 166, 211, 0.85)",
            lineWidth: 3
        });

        drawLandmarks(ctx, landmarks, {
            color: "#ffffff",
            fillColor: "#ee73b1",
            lineWidth: 1,
            radius: 3
        });

        const gesture = classifyGesture(landmarks);

        if (gesture) {
            updateGestureStability(gesture);
        }
    } else {
        latestGesture = null;
        stableGesture = null;
        gestureHistory = [];
        setDetectedGesture("—");
    }

    ctx.restore();
}

// -----------------------------
// Gesture recognition
// -----------------------------
// We use the four non-thumb fingers because it makes the three gestures
// easier to distinguish with a simple, explainable rule-based CV model.
//
// ROCK     = 0 extended fingers
// PAPER    = 4 extended fingers
// SCISSORS = index + middle extended, ring + pinky folded
function isFingerExtended(landmarks, tip, pip) {
    // In the webcam coordinate system, smaller y means physically higher.
    return landmarks[tip].y < landmarks[pip].y - 0.025;
}

function classifyGesture(landmarks) {
    const index = isFingerExtended(landmarks, 8, 6);
    const middle = isFingerExtended(landmarks, 12, 10);
    const ring = isFingerExtended(landmarks, 16, 14);
    const pinky = isFingerExtended(landmarks, 20, 18);

    const extendedCount = [index, middle, ring, pinky]
        .filter(Boolean).length;

    if (extendedCount === 0) return "ROCK";

    if (extendedCount === 4) return "PAPER";

    if (index && middle && !ring && !pinky) {
        return "SCISSORS";
    }

    return null;
}

function updateGestureStability(gesture) {
    latestGesture = gesture;

    gestureHistory.push(gesture);
    if (gestureHistory.length > 8) {
        gestureHistory.shift();
    }

    const counts = {};
    for (const item of gestureHistory) {
        counts[item] = (counts[item] || 0) + 1;
    }

    let bestGesture = null;
    let bestCount = 0;

    for (const [name, count] of Object.entries(counts)) {
        if (count > bestCount) {
            bestGesture = name;
            bestCount = count;
        }
    }

    // Require the same gesture to be seen in at least 4 recent frames.
    if (bestCount >= 4) {
        stableGesture = bestGesture;
        setDetectedGesture(stableGesture);
    }
}

function setDetectedGesture(gesture) {
    const strong = detectedGesture.querySelector("strong");
    strong.textContent = gesture || "—";
}

// -----------------------------
// Game
// -----------------------------
startBtn.addEventListener("click", async () => {
    if (gameRunning) return;

    const ready = await startCamera();
    if (!ready) return;

    startNewGame();
});

playAgainBtn.addEventListener("click", async () => {
    resultModal.classList.add("hidden");

    const ready = await startCamera();
    if (!ready) return;

    startNewGame();
});

function startNewGame() {
    gameRunning = true;
    currentRound = 0;
    userScore = 0;
    robotScore = 0;
    drawScore = 0;

    updateScoreUI();

    robotMoveEl.textContent = "?";
    emotionBadge.textContent = "💗 READY!";
    startBtn.textContent = "Game Running...";
    startBtn.disabled = true;

    setRobotMessage("Okayyy! Shake your hand with me... shik shik! ✨");

    setTimeout(playNextRound, 700);
}

async function playNextRound() {
    if (!gameRunning) return;

    if (currentRound >= TOTAL_ROUNDS) {
        finishGame();
        return;
    }

    currentRound++;
    roundText.textContent = `${currentRound} / ${TOTAL_ROUNDS}`;

    // Clear old stable state so each round requires a fresh gesture.
    stableGesture = null;
    latestGesture = null;
    gestureHistory = [];
    setDetectedGesture("—");

    robotMoveEl.textContent = "???";
    emotionBadge.textContent = "👀 WATCHING";
    setRobotMessage(getRoundMessage());

    await countdown();
    resolveRound();
}

function getRoundMessage() {
    const messages = [
        "Ready? Show me your best move! 💗",
        "No cheatinggg! I am watching 👀",
        "Shik shik shik! Let's gooo! ✨",
        "I have a secret strategy... maybe 😌",
        "Final round energy!!! 💕"
    ];
    return messages[(currentRound - 1) % messages.length];
}

function countdown() {
    return new Promise((resolve) => {
        countdownCard.classList.add("counting");

        const steps = [
            { text: "3", hint: "Get your hand ready! ✋" },
            { text: "2", hint: "Shik shik! 👋" },
            { text: "1", hint: "One more shik! ✨" },
            { text: "GO!", hint: "HOLD YOUR MOVE! 💗" }
        ];

        let index = 0;

        function next() {
            const step = steps[index];

            countdownText.textContent = step.text;
            countdownHint.textContent = step.hint;

            countdownText.classList.remove("shake");
            void countdownText.offsetWidth;
            countdownText.classList.add("shake");

            if (step.text === "GO!") {
                setTimeout(() => {
                    countdownCard.classList.remove("counting");
                    resolve();
                }, 500);
                return;
            }

            index++;
            setTimeout(next, 750);
        }

        next();
    });
}

function resolveRound() {
    // If the user was moving during the countdown, stableGesture is the
    // last reliable CV result. If no gesture was detected, don't fake one.
    const userMove = stableGesture || latestGesture;

    if (!userMove) {
        setRobotMessage("Awww I couldn't see your hand! Let's retry this round 🥺");
        emotionBadge.textContent = "🥺 TRY AGAIN";

        currentRound--;
        roundText.textContent = `${currentRound} / ${TOTAL_ROUNDS}`;

        setTimeout(playNextRound, 1100);
        return;
    }

    const robotMove = moves[Math.floor(Math.random() * moves.length)];

    robotMoveEl.textContent = robotMove;
    robotMoveEl.classList.remove("win");
    void robotMoveEl.offsetWidth;
    robotMoveEl.classList.add("win");

    const result = getResult(userMove, robotMove);

    if (result === "user") {
        userScore++;
        setRobotEmotion("lose");
        setRobotMessage(getRandom([
            "NOOOO 😭 You got me!",
            "Okay okay... you win this one! 💗",
            "My robot pride has been damaged 😭",
            "That was actually good!! ✨"
        ]));
    } else if (result === "robot") {
        robotScore++;
        setRobotEmotion("win");
        setRobotMessage(getRandom([
            "HEHEHE! I WON! 🤖💗",
            "Beep boop... skill issue? 😌",
            "YAYYY! Robot supremacy! ✨",
            "I knew my strategy would work!"
        ]));
    } else {
        drawScore++;
        setRobotEmotion("draw");
        setRobotMessage(getRandom([
            "Twinsies! It's a draw 💕",
            "Great minds choose alike! ✨",
            "We literally picked the same thing 😂"
        ]));
    }

    updateScoreUI();

    if (currentRound >= TOTAL_ROUNDS) {
        setTimeout(finishGame, 1300);
    } else {
        setTimeout(playNextRound, 1300);
    }
}

function getResult(userMove, robotMove) {
    if (userMove === robotMove) return "draw";

    const wins = {
        ROCK: "SCISSORS",
        PAPER: "ROCK",
        SCISSORS: "PAPER"
    };

    return wins[userMove] === robotMove ? "user" : "robot";
}

function setRobotEmotion(type) {
    if (type === "win") {
        emotionBadge.textContent = "😎 I WIN!";
        robotWrap.classList.add("win");
    } else if (type === "lose") {
        emotionBadge.textContent = "😭 OH NO!";
        robotWrap.classList.add("shake");
    } else {
        emotionBadge.textContent = "🤝 DRAW!";
    }

    setTimeout(() => {
        robotWrap.classList.remove("win", "shake");
    }, 700);
}

function updateScoreUI() {
    robotScoreEl.textContent = robotScore;
    userScoreEl.textContent = userScore;
    drawScoreEl.textContent = drawScore;
}

function finishGame() {
    gameRunning = false;
    startBtn.disabled = false;
    startBtn.textContent = "Start Game ✨";

    countdownText.textContent = "♡";
    countdownHint.textContent = "Game complete!";

    finalRobotScore.textContent = robotScore;
    finalUserScore.textContent = userScore;
    finalRounds.textContent = TOTAL_ROUNDS;
    finalDraws.textContent = drawScore;

    if (userScore > robotScore) {
        resultEmoji.textContent = "🏆";
        resultTitle.textContent = "YOU WON! 💗";
        resultMessage.textContent = "Robo is requesting a rematch immediately. 😭";
        setRobotMessage("Okayyy... rematch! You got lucky! 😤💗");
    } else if (robotScore > userScore) {
        resultEmoji.textContent = "🤖";
        resultTitle.textContent = "ROBO WON! ✨";
        resultMessage.textContent = "The tiny robot is celebrating way too much. 😂";
        setRobotMessage("I WONNN! Don't be sad... rematch? 💗");
    } else {
        resultEmoji.textContent = "🤝";
        resultTitle.textContent = "IT'S A DRAW! 💕";
        resultMessage.textContent = "Perfectly matched! One more game?";
        setRobotMessage("We're too powerful together! 🤝💗");
    }

    createConfetti();
    resultModal.classList.remove("hidden");
}

function createConfetti() {
    confetti.innerHTML = "";

    for (let i = 0; i < 34; i++) {
        const piece = document.createElement("span");

        piece.style.left = `${Math.random() * 100}%`;
        piece.style.top = `${Math.random() * 20 - 10}%`;
        piece.style.animationDelay = `${Math.random() * .7}s`;
        piece.style.transform = `rotate(${Math.random() * 180}deg)`;

        const shapes = ["💗", "✦", "•"];
        piece.textContent = shapes[Math.floor(Math.random() * shapes.length)];

        confetti.appendChild(piece);
    }
}

// -----------------------------
// Robot chat
// -----------------------------
function setRobotMessage(message) {
    speechText.textContent = message;

    speechBubble.classList.remove("bubble-pop");
    void speechBubble.offsetWidth;
    speechBubble.classList.add("bubble-pop");
}

function getRandom(items) {
    return items[Math.floor(Math.random() * items.length)];
}

function robotReply(text) {
    const message = text.toLowerCase();

    if (message.includes("hi") || message.includes("hello") || message.includes("hey")) {
        return "HIIII! 💗 I was waiting for you!";
    }

    if (message.includes("motivat") || message.includes("sad") || message.includes("tired")) {
        return "You got this! One tiny step at a time. ✨🤖";
    }

    if (message.includes("scared") || message.includes("afraid")) {
        return "Me? Scared? Neverrr... okay maybe a little. 👀";
    }

    if (message.includes("love") || message.includes("cute")) {
        return "Awww stoppp, my circuits are blushing! 🥹💗";
    }

    if (message.includes("who are you")) {
        return "I'm Robo! Your pink little Stone-Paper-Scissors buddy. 🤖🎀";
    }

    if (message.includes("rock")) {
        return "Rock? Bold choice. I respect it. ✊";
    }

    if (message.includes("paper")) {
        return "Paper is dangerously powerful against rock! ✋";
    }

    if (message.includes("scissor")) {
        return "Scissors gang! ✌️✨";
    }

    return getRandom([
        "Hmmmm... my tiny robot brain is thinking. 🤔💗",
        "Beep boop! Tell me more! ✨",
        "Hehe, I like talking to you! 💕",
        "Interestinggg! Now let's play a round! 🤖"
    ]);
}

function sendChat() {
    const text = chatInput.value.trim();

    if (!text) return;

    setRobotMessage(robotReply(text));
    chatInput.value = "";
}

chatBtn.addEventListener("click", sendChat);

chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        sendChat();
    }
});

document.querySelectorAll(".quick-chat button").forEach((button) => {
    button.addEventListener("click", () => {
        setRobotMessage(robotReply(button.dataset.chat));
    });
});

// -----------------------------
// Background hearts
// -----------------------------
function spawnHeart() {
    const heart = document.createElement("div");
    heart.className = "heart";
    heart.textContent = getRandom(["♥", "♡", "✦", "✧"]);
    heart.style.left = `${Math.random() * 100}vw`;
    heart.style.bottom = "-20px";
    heart.style.fontSize = `${10 + Math.random() * 18}px`;
    heart.style.animationDuration = `${4 + Math.random() * 4}s`;

    document.body.appendChild(heart);

    setTimeout(() => heart.remove(), 9000);
}

setInterval(spawnHeart, 850);

// Initial state
setRobotMessage("Hiii! Wanna play with me? 💗");
