import {games} from "/js/games.js";
import {processScreenshot, setupOcr} from "/js/ocr2.js";
import {emergeGamingSDK} from "/js/emergamingSDK.js";

const game = games.digger;

const directionStart = {
    directionStart: {
        x: null,
        y: null,
        identifier: null
    },
};

let lastDirection = [];
let buttonsPressed = [];
let loading = false;
let started = false;
let lastScore = NaN;
let score =  NaN;
let clickElements = [];
let screenPoll = null;
let screenshot = null;
let screenshotsMissed = null;
let lastScreenshot = null;
let canvas = null;

let ci = {};
let loadedCallback = function() {}

const handleTouchEvent = (event) => {
    if (event.type === 'touchstart') {
        for (let i = 0; i < event.changedTouches.length; i++) {
            let starting = event.changedTouches[i];
            if (starting.clientX < 200) {
                directionStart.x = starting.clientX;
                directionStart.y = starting.clientY;
                directionStart.identifier = starting.identifier;
            } else {
                for (let j = 0;j < clickElements.length; j++) {
                    let elem = clickElements[i];
                    let rect = elem.getBoundingClientRect();
                    let x1 = rect.x, x2 = rect.x + rect.width, y1 = rect.y, y2 = rect.y + rect.height;
                    if (starting.clientX > x1 && starting.clientX < x2 && starting.clientY > y1 && starting.clientY < y2) {
                        if (elem.id && elem.id.startsWith("ctl")) {
                            simulateKeyPress(elem.id, true);
                            buttonsPressed.push({identifier:starting.identifier, id:elem.id, x:starting.clientX, y:starting.clientY});
                        }
                    }
                }
            }
        }
    } else if (event.type === 'touchend') {
        for (let i = 0; i < event.changedTouches.length; i++) {
            let ending = event.changedTouches[i];
            if (ending.identifier === directionStart.identifier) {
                directionStart.x = null;
                directionStart.y = null;
                directionStart.identifier = null;
                if (lastDirection.length > 0) {
                    processDirectionChange(lastDirection, [])
                }
                lastDirection = [];
            } else {
                let released = buttonsPressed.find(item => item.identifier === ending.identifier)
                if (released) {
                    simulateKeyPress(released.id, false)
                    buttonsPressed = buttonsPressed.filter(item => item.identifier !== ending.identifier)
                }
            }
        }
    } else if (event.type === 'touchmove') {

        for (let i = 0; i < event.changedTouches.length; i++) {
            let moving = event.changedTouches[i];
            if (moving.clientX < 200) {
                let control = []
                let dx = moving.clientX - directionStart.x;
                let dy = moving.clientY - directionStart.y;
                if (dx === 0 && dy === 0) return
                let r = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2))
                let angle = radToDeg(Math.asin(dy/r)) + 90
                if (dx < 0) angle = (180 - angle) + 180

                if (game.directions === 4) {
                    if (angle >= 315 || angle < 45) control=['up']
                    else if (angle >= 45 && angle < 135) control=['right']
                    else if (angle >= 135 && angle < 225) control = ['down']
                    else if (angle >= 225 && angle < 315) control = ['left']
                    else {
                        log.error ('unknown angle ' + angle);
                    }
                } else if (game.directions === 8) {

                    if (angle >= 338 || angle < 23) control = ['up']
                    else if (angle >= 23 && angle < 68) control = ['up', 'right']
                    else if (angle >= 68 && angle < 113) control = ['right']
                    else if (angle >= 113 && angle < 158) control = ['down', 'right']
                    else if (angle >= 158 && angle < 203) control = ['down']
                    else if (angle >= 203 && angle < 248) control = ['down', 'left']
                    else if (angle >= 248 && angle < 293) control = ['left']
                    else if (angle >= 293 && angle < 338) control = ['up', 'left']
                    else {
                        console.error ('unknown angle '+ angle);
                    }
                } else {
                    console.error('directions need to be 4 or 8')
                }

                processDirectionChange(lastDirection, control)
                lastDirection = control;
            }
        }
    }
    event.stopImmediatePropagation();
    event.preventDefault()
}

const processDirectionChange = (was, is) => {
    let turnOff = was.filter(w => is.indexOf(w) === -1)
    let turnOn = is.filter(i => was.indexOf(i) === -1)
    turnOff.forEach((item) => {
        simulateKeyPress(item, false);
    });
    turnOn.forEach((item) => simulateKeyPress(item, true));
}

const simulateKeyPress = (button, pressed) => {
    ci.simulateKeyEvent(game.keys[button].ascii, pressed)
}

const radToDeg = (rad) => {
    return Math.round(rad * 180 / Math.PI);
}

const init = () => {
    canvas = document.getElementById("axCanvas");
    loading = true
    started = true;
}

export const start = () => {
    if (game.ocrScore) {
        let startX = game.ocrScore.scoreX
        let startY = game.ocrScore.scoreY
        let charWidth = game.ocrScore.charWidth
        let charHeight = game.ocrScore.charHeight
        let charSpacing = game.ocrScore.charSpacing
        let numChars = game.ocrScore.numChars;
        let referenceChars = game.ocrScore.referenceChars;
        setupOcr(startX, startY, charWidth, charHeight, charSpacing, numChars, referenceChars);
    }
    startDosBox();

}

const unloadEvent = () => {
    removeEventListeners()
    if (ci) {
        try {
        ci.exit();
        } catch (e) {
            console.log ('Unload event failed');
        }
    }
}

const addEventListeners = () => {

    document.addEventListener('touchstart', handleTouchEvent);
    document.addEventListener('touchend', handleTouchEvent);
    document.addEventListener('touchmove', handleTouchEvent);

    console.log ("Adding key event listener:" + !!game.remapKeys)

    if (game.remapKeys) document.addEventListener('keydown', handleKeyEvent);
    if (game.remapKeys) document.addEventListener('keyup', handleKeyEvent);

    window.addEventListener('beforeunload', unloadEvent)
}

const handleKeyEvent = (event) => {
    if (event.keyCode) {
        event.preventDefault();
        event.cancelBubble;
        if (event.keyCode in game.remapKeys) {
            ci.simulateKeyEvent(game.remapKeys[event.keyCode], event.type === 'keydown');
        }
        return false;
    }
}

const removeEventListeners = () => {

    document.removeEventListener('touchstart', handleTouchEvent, false);
    document.removeEventListener('touchend', handleTouchEvent, false);
    document.removeEventListener('touchmove', handleTouchEvent, false);

    console.log ("Removing key event listener")

    window.removeEventListener('keydown', handleKeyEvent)
    window.removeEventListener('keyup', handleKeyEvent)
    window.removeEventListener('beforeunload', unloadEvent);

}

const isTouch = () => {
    return (('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0) ||
        (navigator.msMaxTouchPoints > 0));
}

export const loadingComplete = (callback) => {
    loadedCallback = callback;
}

const dosReady = () => {
    clickElements = document.getElementsByClassName('axControl');
    addEventListeners();
    setupScreenPoll();
    if (loadedCallback) loadedCallback();
}

const endGame = (score) => {
    console.log ("Ending game with score " + score)
    emergeGamingSDK.endLevel(score);
    setTimeout(() => location.reload(), 500);
    clearInterval(screenPoll)
    unloadEvent();
}

const setupScreenPoll = function() {

    let canvasContext = canvas.getContext('2d');
    let lastPixelColour = null;

    screenPoll = setInterval(() => {

        let currentPixelColour = null
        let pixelData = canvasContext.getImageData(65,0,1,1).data

        if (pixelData[0] === 85 && pixelData[1] === 255 && pixelData[2] === 255) {
            currentPixelColour = "blue";
            if (currentPixelColour !== lastPixelColour) {
                console.log ("Start: ");
                emergeGamingSDK.startLevel();
            }
        } else if (pixelData[0] === 255 && pixelData[1] === 255 && pixelData[2] === 255) {
            if (currentPixelColour !== lastPixelColour) {
                processScreenshot(canvas.toDataURL('image/png')).then((_score) => {
                    endGame(_score);
                });
            }
        } else {
            currentPixelColour = "black"
        }

        lastPixelColour = currentPixelColour;

     }, game.ocrScore.interval);
}


const startDosBox = () => {
    Dos(canvas, {
        cycles: game.cycles,
        wdosboxUrl: '/assets/dosbox/wdosbox.js',
    }).ready((fs, main) => {
        fs.extract("/assets/games/digger.zip").then(() => {
            main(["-c", "DIGGER.COM"]).then((_ci) => {
                ci = _ci;
                dosReady();
            })
        });
    });
}

window.addEventListener("load", init);
