
// =========================================
// TIMEFLOW - ALARM CLOCK LOGIC
// =========================================

const currentTimeElement = document.getElementById("current-time");
const currentDateElement = document.getElementById("current-date");

const alarmForm = document.getElementById("alarm-form");
const hourInput = document.getElementById("hour");
const minuteInput = document.getElementById("min");
const secondInput = document.getElementById("sec");

const alarmListElement = document.getElementById("alarm-list");
const alarmCountElement = document.getElementById("alarm-count");
const emptyState = document.getElementById("empty-state");

const activeSummary = document.getElementById("active-summary");
const clearAllButton = document.getElementById("clear-all");

const alarmAudio = document.getElementById("alarm-audio");
const ringingAlert = document.getElementById("ringing-alert");
const ringingTimeElement = document.getElementById("ringing-time");
const stopRingingButton = document.getElementById("stop-ringing");

document.getElementById("footer-year").textContent =
    new Date().getFullYear();

const alarms = new Map();

let nextAlarmId = 1;
let audioUnlocked = false;
let lastCheckedSecond = "";

// =========================================
// LIVE CLOCK
// =========================================

function padTime(value) {
    return String(value).padStart(2, "0");
}

function getTimeString(date = new Date()) {
    return [
        padTime(date.getHours()),
        padTime(date.getMinutes()),
        padTime(date.getSeconds())
    ].join(":");
}

function updateClock() {
    const now = new Date();

    const time = getTimeString(now);
    const [hours, minutes, seconds] = time.split(":");

    // Use separate elements for each part of the clock.
    currentTimeElement.replaceChildren();

    [hours, minutes, seconds].forEach((part, index) => {
        if (index > 0) {
            const colon = document.createElement("span");
            colon.className = "clock-colon";
            colon.textContent = ":";
            currentTimeElement.appendChild(colon);
        }

        const digit = document.createElement("span");
        digit.textContent = part;
        currentTimeElement.appendChild(digit);
    });

    currentDateElement.textContent = now.toLocaleDateString(
        undefined,
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

    // Check only once per clock second.
    if (time !== lastCheckedSecond) {
        lastCheckedSecond = time;
        checkAlarms(time);
    }
}

updateClock();

// Align updates to the next whole second.
function scheduleClockUpdate() {
    const delay = 1000 - (Date.now() % 1000);

    setTimeout(() => {
        updateClock();
        scheduleClockUpdate();
    }, delay);
}

scheduleClockUpdate();

// =========================================
// VALIDATE AND ADD ALARMS
// =========================================

function isValidTime(value, max) {
    return value.trim() !== "" &&
        Number.isInteger(Number(value)) &&
        Number(value) >= 0 &&
        Number(value) <= max;
}

alarmForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const hour = hourInput.value;
    const minute = minuteInput.value;
    const second = secondInput.value;

    if (
        !isValidTime(hour, 23) ||
        !isValidTime(minute, 59) ||
        !isValidTime(second, 59)
    ) {
        alert("Please enter a valid time: HH (00–23), MM (00–59), SS (00–59).");
        return;
    }

    const time = [
        padTime(Number(hour)),
        padTime(Number(minute)),
        padTime(Number(second))
    ].join(":");

    if ([...alarms.values()].some(alarm => alarm.time === time)) {
        alert(`An alarm for ${time} is already set.`);
        return;
    }

    // Browsers may require a user interaction before playing audio.
    // Attempt to unlock audio while the user is interacting.
    await unlockAudio();

    const id = nextAlarmId++;

    alarms.set(id, {
        id,
        time,
        triggered: false
    });

    renderAlarms();
    alarmForm.reset();

    // Move focus back to the hours field for quick entry.
    hourInput.focus();
});

// =========================================
// AUDIO INITIALIZATION
// =========================================

async function unlockAudio() {
    if (audioUnlocked) return;

    try {
        alarmAudio.muted = true;
        await alarmAudio.play();

        alarmAudio.pause();
        alarmAudio.currentTime = 0;
        alarmAudio.muted = false;

        audioUnlocked = true;
    } catch (error) {
        alarmAudio.muted = false;

        // Playback will be attempted again when an alarm rings.
        console.info(
            "Audio permission is not available yet. " +
            "Interact with the page to enable alarm sounds."
        );
    }
}

// =========================================
// DISPLAY ALARMS
// =========================================

function renderAlarms() {
    alarmListElement.replaceChildren();

    const sortedAlarms = [...alarms.values()].sort((a, b) => {
        return a.time.localeCompare(b.time);
    });

    alarmCountElement.textContent = sortedAlarms.length;

    clearAllButton.disabled = sortedAlarms.length === 0;

    activeSummary.textContent =
        sortedAlarms.length === 0
            ? "No active alarms"
            : `${sortedAlarms.length} active alarm${sortedAlarms.length === 1 ? "" : "s"}`;

    if (sortedAlarms.length === 0) {
        alarmListElement.appendChild(emptyState);
        return;
    }

    sortedAlarms.forEach(alarm => {
        const item = document.createElement("li");
        item.className = "alarm-item";
        item.dataset.alarmId = alarm.id;

        if (alarm.triggered) {
            item.classList.add("ringing");
        }

        const iconBox = document.createElement("div");
        iconBox.className = "alarm-item-icon";

        iconBox.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.8">
                <circle cx="12" cy="13" r="8"></circle>
                <path d="M12 9v4l3 2M5 3 2 6M19 3l3 3"></path>
            </svg>
        `;

        const details = document.createElement("div");
        details.className = "alarm-details";

        const timeElement = document.createElement("div");
        timeElement.className = "alarm-time";
        timeElement.textContent = alarm.time;

        const statusElement = document.createElement("span");
        statusElement.className = "alarm-status";
        statusElement.textContent = alarm.triggered
            ? "Alarm is ringing"
            : "Scheduled alarm";

        details.append(timeElement, statusElement);

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-alarm";
        deleteButton.setAttribute("aria-label", `Delete alarm ${alarm.time}`);

        deleteButton.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.8">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"></path>
                <path d="M10 10v6M14 10v6"></path>
            </svg>
        `;

        deleteButton.addEventListener("click", () => {
            alarms.delete(alarm.id);

            // Stop sound if this alarm is currently ringing.
            if (alarm.triggered) {
                stopAlarmSound();
            }

            renderAlarms();
        });

        item.append(iconBox, details, deleteButton);
        alarmListElement.appendChild(item);
    });
}

// =========================================
// CHECK AND TRIGGER ALARMS
// =========================================

function checkAlarms(currentTime) {
    const matchingAlarm = [...alarms.values()].find(alarm => {
        return alarm.time === currentTime && !alarm.triggered;
    });

    if (!matchingAlarm) return;

    matchingAlarm.triggered = true;

    renderAlarms();

    ringingTimeElement.textContent = matchingAlarm.time;
    ringingAlert.hidden = false;

    playAlarmSound();
}

async function playAlarmSound() {
    try {
        alarmAudio.currentTime = 0;
        alarmAudio.muted = false;
        await alarmAudio.play();
    } catch (error) {
        console.warn(
            "The alarm sound could not play. " +
            "Check that the audio file exists and browser playback is allowed."
        );

        alert(
            "Your alarm time has arrived, but the sound could not play. " +
            "Please check your audio file and browser permissions."
        );
    }
}

// =========================================
// STOP ALARM
// =========================================

function stopAlarmSound() {
    alarmAudio.pause();
    alarmAudio.currentTime = 0;

    ringingAlert.hidden = true;

    // Mark the current alarms as acknowledged.
    alarms.forEach(alarm => {
        if (alarm.triggered) {
            alarm.triggered = false;
        }
    });

    renderAlarms();
}

stopRingingButton.addEventListener("click", stopAlarmSound);

// =========================================
// CLEAR ALL ALARMS
// =========================================

clearAllButton.addEventListener("click", () => {
    if (alarms.size === 0) return;

    alarms.clear();

    stopAlarmSound();
    renderAlarms();
});

// Initial UI
renderAlarms();
