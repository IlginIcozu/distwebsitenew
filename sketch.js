// sketch.js — p5 + Tone driven shader artwork for the dist.cs landing page.

let basicShader;
let basicShader2;
let shaderTexture, shaderTexture2;
let alp1 = 255,
    alp2 = 255;
let maxAlp = 80,
    minAlp = 30;

let fmSynth, filter, filter2, lfo, lfoResonance;
let fmSynthPlaying = false;
let noiseSynth;
let autoFilter;
let audioStarted = false; // True once the user has unlocked & triggered audio.

let textGraphics;

let state = "main"; // "main" or "overlay"

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
        .test(navigator.userAgent);
}

function preload() {
    basicShader = loadShader('shader.vert', 'shader.frag');
    basicShader2 = loadShader('shader.vert', 'shader2.frag');
}

function setup() {
    let canvas = createCanvas(windowWidth, windowHeight, WEBGL);
    canvas.parent('p5-container');

    // On mobile we skip the artwork (some devices crash on the shader) and
    // lock the overlay open as the only view.
    if (isMobile()) {
        state = "overlay";
        canvas.style('display', 'none');
        document.body.classList.add('mobile-only');
        if (typeof window.distOpenOverlay === 'function') {
            window.distOpenOverlay({ silent: true });
        }
        noLoop();
        return;
    }

    let seed = random() * 999999;
    randomSeed(seed);
    noiseSeed(seed);

    shaderTexture = createGraphics(windowWidth, windowHeight, WEBGL);
    shaderTexture.noStroke();
    shaderTexture.pixelDensity(1);

    shaderTexture2 = createGraphics(windowWidth, windowHeight, WEBGL);
    shaderTexture2.noStroke();
    shaderTexture2.pixelDensity(1);

    textGraphics = createGraphics(windowWidth, windowHeight);
    textGraphics.pixelDensity(1);

    canvas.elt.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        noLoop();
    }, false);
    canvas.elt.addEventListener('webglcontextrestored', () => {
        if (state === 'main') loop();
    }, false);

    pixelDensity(1);
    noCursor();

    setupToneJS();

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            pauseAudio();
        } else if (state === 'main') {
            resumeAudio();
        }
    });

    // React to the new overlay opening/closing.
    window.addEventListener('distcs:overlay-open', () => {
        state = 'overlay';
        cursor('default');
        pauseAudio();
        noLoop();
    });

    window.addEventListener('distcs:overlay-close', () => {
        state = 'main';
        loop();
        resumeAudio();
    });
}

// Browsers keep the AudioContext suspended until a user gesture explicitly
// unlocks it. Call this from inside a click/touch handler.
function unlockAudio() {
    if (typeof Tone === 'undefined') return;
    if (Tone.context && Tone.context.state !== 'running') {
        Tone.start();
    }
}

function startAudio() {
    if (typeof Tone === 'undefined' || !fmSynth) return;
    unlockAudio();
    if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
    }
    if (!fmSynthPlaying) {
        fmSynth.triggerAttack("D2");
        fmSynthPlaying = true;
    }
    if (noiseSynth && noiseSynth.state !== "started") {
        noiseSynth.start();
    }
    audioStarted = true;
}

function pauseAudio() {
    if (typeof Tone === 'undefined') return;
    if (Tone.Transport.state === 'started') {
        Tone.Transport.pause();
    }
    if (fmSynthPlaying && fmSynth) {
        fmSynth.triggerRelease();
        fmSynthPlaying = false;
    }
    if (noiseSynth && noiseSynth.state === "started") {
        noiseSynth.stop();
    }
}

function resumeAudio() {
    // Only auto-resume if the user had previously started audio.
    if (!audioStarted) return;
    if (typeof Tone === 'undefined' || !fmSynth) return;
    if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
    }
    if (!fmSynthPlaying) {
        fmSynth.triggerAttack("D2");
        fmSynthPlaying = true;
    }
    if (noiseSynth && noiseSynth.state !== "started") {
        noiseSynth.start();
    }
}

function draw() {
    if (state !== 'main') return;

    background(0);

    let mx = mouseX - width / 2;
    let my = mouseY - height / 2;
    let d = dist(mx, my, 0, 0);

    if (d <= 50) {
        cursor('pointer');
    } else {
        noCursor();
    }

    basicShader.setUniform('u_pixelDensity', pixelDensity());
    basicShader.setUniform("uTexture0", shaderTexture);
    basicShader.setUniform('u_resolution', [width, height]);
    basicShader.setUniform('u_time', millis() / 1000.0);
    basicShader.setUniform('u_speed', 1.0);
    basicShader.setUniform('u_windSpeed', 1.0);
    basicShader.setUniform('u_mouse', [mouseX, height - mouseY]);
    basicShader.setUniform('u_middle', [width, height]);

    basicShader2.setUniform('u_pixelDensity', pixelDensity());
    basicShader2.setUniform("uTexture0", shaderTexture);
    basicShader2.setUniform('u_resolution', [width, height]);
    basicShader2.setUniform('u_time', millis() / 1000.0);
    basicShader2.setUniform('u_speed', 1.0);
    basicShader2.setUniform('u_windSpeed', 1.0);
    basicShader2.setUniform('u_mouse', [mouseX, height - mouseY]);
    basicShader2.setUniform('u_middle', [width, height]);

    shaderTexture.shader(basicShader);
    shaderTexture.rect(0, 0, width, height);

    shaderTexture2.shader(basicShader2);
    shaderTexture2.rect(0, 0, width, height);

    translate(-width / 2, -height / 2);

    let d2 = dist(mx, my, 0, 0);
    if (d2 > maxAlp) {
        alp1 = 255;
        alp2 = 0;
    } else if (d2 < maxAlp && d2 > minAlp) {
        alp1 = map(d2, maxAlp, minAlp, 255, 0);
        alp2 = map(d2, maxAlp, minAlp, 0, 255);
    } else {
        alp1 = 0;
        alp2 = 255;
    }

    tint(255, alp1);
    image(shaderTexture, 0, 0);

    tint(255, alp2);
    image(shaderTexture2, 0, 0);

    let textOpacity;
    if (d <= 50) {
        textOpacity = map(d, 50, 0, 0, 255);
    } else {
        textOpacity = 0;
    }

    textGraphics.clear();
    textGraphics.fill(255, textOpacity);
    textGraphics.textFont('monospace');
    textGraphics.textAlign(CENTER, CENTER);
    textGraphics.textSize(15);
    image(textGraphics, 0, 0);

    updateLFOResonance();
}

function windowResized() {
    if (isMobile()) return;
    noLoop();
    setTimeout(() => {
        resizeCanvas(windowWidth, windowHeight, WEBGL);
        shaderTexture.resizeCanvas(windowWidth, windowHeight, WEBGL);
        shaderTexture2.resizeCanvas(windowWidth, windowHeight, WEBGL);
        textGraphics.resizeCanvas(windowWidth, windowHeight);
        if (state === 'main') loop();
    }, 100);
}

function keyPressed() {
    if (key == 's') {
        saveCanvas('LucidDream_DistCollective', 'png');
    }
}

function touchStarted() {
    mousePressed();
}

function mousePressed() {
    if (state !== "main") return;

    // Unlock the AudioContext on the first user gesture, even if this click
    // ends up opening the overlay — that way audio can resume on close if
    // it had been started.
    unlockAudio();

    let mx = mouseX - width / 2;
    let my = mouseY - height / 2;
    let d = dist(mx, my, 0, 0);

    if (d <= 50) {
        if (typeof window.distOpenOverlay === 'function') {
            window.distOpenOverlay();
        }
        return;
    }

    startAudio();
}

function setupToneJS() {
    fmSynth = new Tone.FMSynth({
        harmonicity: 3,
        modulationIndex: 20,
        oscillator: { type: "sine" },
        modulation: { type: "sawtooth" },
        envelope: { attack: 0.1, decay: 0.3, sustain: 0.6, release: 0.8 },
        modulationEnvelope: { attack: 0.1, decay: 0.2, sustain: 0.7, release: 0.5 },
    });

    const distortion = new Tone.Distortion(2.8);

    filter = new Tone.Filter({ type: "lowpass", frequency: 400, rolloff: -24, Q: 10 });
    filter2 = new Tone.Filter({ type: "lowpass", frequency: 1000, rolloff: -24, Q: 5 });

    const cheby = new Tone.Chebyshev(101);
    const crusher = new Tone.BitCrusher(2);

    fmSynth.connect(distortion);
    distortion.connect(crusher);
    crusher.connect(cheby);
    cheby.connect(filter);
    filter.toDestination();

    lfo = new Tone.LFO({ frequency: "0.1n", min: 100, max: 1000 }).start();
    lfo.connect(filter.frequency);

    lfoResonance = new Tone.LFO({ frequency: "1n", min: 0.5, max: 8 }).start();
    lfoResonance.connect(filter.Q);

    noiseSynth = new Tone.Noise("white");
    noiseSynth.volume.value = -12;
    fmSynth.volume.value = -12;

    autoFilter = new Tone.AutoFilter({
        frequency: "4n",
        baseFrequency: 200,
        resonance: 0,
        octaves: 2,
    });
    autoFilter.toDestination();
    noiseSynth.connect(autoFilter);
    autoFilter.start();
    autoFilter.connect(filter2);
    filter2.toDestination();

    Tone.Transport.start();
}

function updateLFOResonance() {
    let cMX = constrain(mouseX, 0, width);
    let cMY = constrain(mouseY, 0, height);

    let mx = cMX - width / 2;
    let my = cMY - height / 2;

    let d = dist(mx, my, 0, 0);
    if (d < 0.001) d = 0.001;
    let maxDist = max(width, height);

    let minFre = 2000;
    let maxFre = 4000;

    let lfoFrequency = map(d, 0.001, maxDist, random(30, 50), 0.01);
    lfoFrequency = max(lfoFrequency, 0.0001);

    let filterFreq = map(d, 0.001, maxDist, maxFre, minFre);
    filterFreq = max(filterFreq, 0.0001);

    let lfoFrequency2 = map(d, maxDist, 0.001, 0.01, 20);
    lfoFrequency2 = max(lfoFrequency2, 0.0001);

    lfoResonance.frequency.value = lfoFrequency;
    autoFilter.frequency.value = lfoFrequency2;
    filter2.frequency.value = filterFreq;

    let newQ = map(cMX, 0, width, 10, 0);
    newQ = max(newQ, 0.0001);
    filter2.Q.value = newQ;

    let newHarm = map(cMX, 0, width, 3, 3.1);
    newHarm = max(newHarm, 0.0001);
    fmSynth.harmonicity.value = newHarm;

    let newModIndex = map(cMY, 0, height, 40, 0);
    newModIndex = max(newModIndex, 0.0001);
    fmSynth.modulationIndex.value = newModIndex;

    let nMax = 0;
    let modulatedVolSynth = constrain(map(sin(millis() / (d / 100)), -1, 1, -10, -5), -50, -10);
    fmSynth.volume.value = modulatedVolSynth;

    let modulatedVolNoise = map(noise(mx, my), 0, 1, random(-40, -10), nMax);
    noiseSynth.volume.value = modulatedVolNoise;

    if (d < 50) {
        lfo.min = map(d, 0.001, 60, 60, 30);
        lfo.max = 60;

        let tmpFreq = map(d, 0, 50, 100, 0);
        tmpFreq = max(tmpFreq, 0.0001);
        filter2.frequency.value = tmpFreq;

        noiseSynth.volume.value = map(d, 0.001, 50, -5, -100);
    } else {
        lfo.min = 120;
        lfo.max = map(d, 50, maxDist, 200, 2000);
    }
}
