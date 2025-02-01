const videoConfig = {
    video: { width: 640, height: 480, fps: 30 },
};
let videoElementWidth, videoElementHeight, canvasContext, canvasElement, handGestureEstimator;
let handPoseModel;

const gestureSymbols = {
    thumbsUp: '👍',
    victory: '✌🏻',
    thumbsDown: '👎',
};

const fingerIndices = {
    thumb: [0, 1, 2, 3, 4],
    indexFinger: [0, 5, 6, 7, 8],
    middleFinger: [0, 9, 10, 11, 12],
    ringFinger: [0, 13, 14, 15, 16],
    pinky: [0, 17, 18, 19, 20],
};

const fingerColors = {
    thumb: 'red',
    indexFinger: 'blue',
    middleFinger: 'yellow',
    ringFinger: 'green',
    pinky: 'pink',
    palmBase: 'white',
};

function defineThumbsDownGesture() {
    const thumbsDownGesture = new fp.GestureDescription('thumbsDown');

    thumbsDownGesture.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl);
    thumbsDownGesture.addDirection(
        fp.Finger.Thumb,
        fp.FingerDirection.VerticalDown,
        1.0
    );
    thumbsDownGesture.addDirection(
        fp.Finger.Thumb,
        fp.FingerDirection.DiagonalDownLeft,
        0.9
    );
    thumbsDownGesture.addDirection(
        fp.Finger.Thumb,
        fp.FingerDirection.DiagonalDownRight,
        0.9
    );

    for (let finger of [
        fp.Finger.Index,
        fp.Finger.Middle,
        fp.Finger.Ring,
        fp.Finger.Pinky,
    ]) {
        thumbsDownGesture.addCurl(finger, fp.FingerCurl.FullCurl, 0.9);
        thumbsDownGesture.addCurl(finger, fp.FingerCurl.HalfCurl, 0.9);
    }

    return thumbsDownGesture;
}

function renderKeypoints(keypoints) {
    for (let i = 0; i < keypoints.length; i++) {
        const y = keypoints[i][0];
        const x = keypoints[i][1];
        drawCircle(x - 2, y - 2, 3);
    }

    const fingerNames = Object.keys(fingerIndices);
    for (let i = 0; i < fingerNames.length; i++) {
        const finger = fingerNames[i];
        const points = fingerIndices[finger].map((idx) => keypoints[idx]);
        drawPath(points, false, fingerColors[finger]);
    }
}

function drawCircle(y, x, radius) {
    canvasContext.beginPath();
    canvasContext.arc(x, y, radius, 0, 2 * Math.PI);
    canvasContext.fill();
}

function drawPath(points, closePath, color) {
    canvasContext.strokeStyle = color;
    const path = new Path2D();
    path.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
        const point = points[i];
        path.lineTo(point[0], point[1]);
    }

    if (closePath) {
        path.closePath();
    }
    canvasContext.stroke(path);
}

async function initializeWebcam(width, height, fps) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser API navigator.mediaDevices.getUserMedia is not available');
    }

    let videoElement = document.getElementById('webcam');
    videoElement.muted = true;
    videoElement.width = width;
    videoElement.height = height;

    const mediaConfig = {
        audio: false,
        video: {
            facingMode: 'user',
            width: width,
            height: height,
            frameRate: { max: fps },
        },
    };

    const stream = await navigator.mediaDevices.getUserMedia(mediaConfig);
    videoElement.srcObject = stream;

    return new Promise((resolve) => {
        videoElement.onloadedmetadata = () => {
            resolve(videoElement);
        };
    });
}

async function loadVideoStream() {
    const video = await initializeWebcam(
        videoConfig.video.width,
        videoConfig.video.height,
        videoConfig.video.fps
    );
    video.play();
    return video;
}

async function startHandDetection(video) {
    async function detectLandmarks() {
        canvasContext.drawImage(
            video,
            0,
            0,
            videoElementWidth,
            videoElementHeight,
            0,
            0,
            canvasElement.width,
            canvasElement.height
        );

        const predictions = await handPoseModel.estimateHands(video);
        if (predictions.length > 0) {
            const keypoints = predictions[0].landmarks;
            renderKeypoints(keypoints);
        }

        if (
            predictions.length > 0 &&
            Object.keys(predictions[0]).includes('landmarks')
        ) {
            const estimation = handGestureEstimator.estimate(predictions[0].landmarks, 9);
            if (estimation.gestures.length > 0) {
                let bestMatch = estimation.gestures.reduce((prev, current) => {
                    return prev.score > current.score ? prev : current;
                });

                if (bestMatch.score > 9.9) {
                    document.getElementById('gesture-text').textContent =
                        gestureSymbols[bestMatch.name];
                }
            }
        }

        requestAnimationFrame(detectLandmarks);
    }

    const predefinedGestures = [
        fp.Gestures.VictoryGesture,
        fp.Gestures.ThumbsUpGesture,
        defineThumbsDownGesture(),
    ];

    handGestureEstimator = new fp.GestureEstimator(predefinedGestures);
    handPoseModel = await handpose.load();
    detectLandmarks();
}

async function initializeApp() {
    let video = await loadVideoStream();

    videoElementWidth = video.videoWidth;
    videoElementHeight = video.videoHeight;

    canvasElement = document.getElementById('canvas');
    canvasElement.width = videoElementWidth;
    canvasElement.height = videoElementHeight;

    canvasContext = canvasElement.getContext('2d');
    canvasContext.clearRect(0, 0, videoElementWidth, videoElementHeight);

    canvasContext.fillStyle = 'white';
    canvasContext.translate(canvasElement.width, 0);
    canvasContext.scale(-1, 1);

    startHandDetection(video);
}

initializeApp();
