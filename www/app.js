let port;
let reader;
let writer;
let inputHistory = [];
let historyIndex = -1;

const connectBtn = document.getElementById('connect-btn');
const baudRateSelect = document.getElementById('baud-rate');
const customBaudContainer = document.getElementById('custom-baud-container');
const customBaudInput = document.getElementById('custom-baud');
const terminalOutput = document.getElementById('terminal-output');
const terminalInput = document.getElementById('terminal-input');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');
const statusIndicator = document.getElementById('connection-status');
const rxLed = document.getElementById('rx-activity');
const txLed = document.getElementById('tx-activity');

// UI Handlers
baudRateSelect.addEventListener('change', () => {
    if (baudRateSelect.value === 'custom') {
        customBaudContainer.classList.remove('hidden');
    } else {
        customBaudContainer.classList.add('hidden');
    }
});

connectBtn.addEventListener('click', async () => {
    if (port) {
        await disconnect();
    } else {
        await connect();
    }
});

sendBtn.addEventListener('click', sendData);
terminalInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendData();
});

clearBtn.addEventListener('click', () => {
    terminalOutput.innerHTML = '';
});

// Web Serial Logic
async function connect() {
    try {
        port = await navigator.serial.requestPort();
        const baudRate = baudRateSelect.value === 'custom' 
            ? parseInt(customBaudInput.value) 
            : parseInt(baudRateSelect.value);

        await port.open({ baudRate });
        
        statusIndicator.textContent = 'Connected';
        statusIndicator.classList.replace('disconnected', 'connected');
        connectBtn.textContent = 'Disconnect';
        
        logToTerminal('System', `Connected to device at ${baudRate} baud.`, 'system-msg');
        
        readLoop();
    } catch (err) {
        console.error(err);
        logToTerminal('Error', `Connection failed: ${err.message}`, 'error-msg');
    }
}

async function disconnect() {
    if (reader) {
        await reader.cancel();
    }
    if (port) {
        await port.close();
        port = null;
    }
    statusIndicator.textContent = 'Disconnected';
    statusIndicator.classList.replace('connected', 'disconnected');
    connectBtn.textContent = 'Connect Device';
    logToTerminal('System', 'Disconnected.', 'system-msg');
}

async function readLoop() {
    while (port && port.readable) {
        reader = port.readable.getReader();
        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                flashLed(rxLed);
                const text = new TextDecoder().decode(value);
                
                if (text.includes("[DIAGNOSTIC] Warning: Potential RX/TX swap detected!")) {
                    document.getElementById('wiring-alert').classList.remove('hidden');
                    logToTerminal('Diagnostic', 'Potential RX/TX swap detected!', 'error-msg');
                }
                
                appendTerminalText(text, 'rx-msg');
            }
        } catch (err) {
            console.error(err);
            break;
        } finally {
            reader.releaseLock();
        }
    }
}

async function sendData() {
    if (!port || !port.writable) {
        logToTerminal('Error', 'Device not connected or not writable.', 'error-msg');
        return;
    }
    
    const text = terminalInput.value;
    if (!text) return;

    writer = port.writable.getWriter();
    const data = new TextEncoder().encode(text + '\r\n');
    await writer.write(data);
    writer.releaseLock();

    flashLed(txLed);
    logToTerminal('TX', text, 'tx-msg');
    
    inputHistory.push(text);
    historyIndex = inputHistory.length;
    terminalInput.value = '';
}

function logToTerminal(prefix, msg, className) {
    const div = document.createElement('div');
    const time = new Date().toLocaleTimeString();
    const timestamp = document.getElementById('timestamp').checked ? `[${time}] ` : '';
    div.className = className;
    div.textContent = `${timestamp}${prefix}: ${msg}`;
    terminalOutput.appendChild(div);
    
    if (document.getElementById('autoscroll').checked) {
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }
}

function appendTerminalText(text, className) {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    terminalOutput.appendChild(span);
    
    if (document.getElementById('autoscroll').checked) {
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }
}

function flashLed(led) {
    led.classList.add('active');
    setTimeout(() => led.classList.remove('active'), 50);
}

// Check for Web Serial support
if (!('serial' in navigator)) {
    logToTerminal('Warning', 'Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.', 'error-msg');
    connectBtn.disabled = true;
}
