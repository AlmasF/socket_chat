import toastifyJs from "https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/+esm";
import { io } from "https://cdn.socket.io/4.8.3/socket.io.esm.min.js";
import { classifyText } from "./classificator.js";

let counter = 0;
const socket = io({
  auth: {
    serverOffset: 0,
  },
  ackTimeout: 10000,
  retries: 3,
});

const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");
const toggleButton = document.getElementById("toggle-btn");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (input.value) {
    const clientOffset = `${socket.id}-${counter++}`;
    socket.emit("chat message", input.value, clientOffset);
    input.value = "";
  }
});

socket.on("chat message", async (msg, serverOffset) => {
  const item = document.createElement("li");
  item.textContent = msg;
  messages.appendChild(item);
  const result = await classifyText(msg);
  if (result?.[0]?.label == "LABEL_1") {
    toastifyJs({
      text: "Подозрительное сообщение!",
      duration: 3000,
      newWindow: true,
      close: true,
      gravity: "top", // `top` or `bottom`
      position: "left", // `left`, `center` or `right`
      stopOnFocus: true, // Prevents dismissing of toast on hover
      style: {
        background: "linear-gradient(to right, #00b09b, #f00)",
      },
      onClick: function () {}, // Callback after click
    }).showToast();
  }
  window.scrollTo(0, document.body.scrollHeight);
  socket.auth.serverOffset = serverOffset;
});

toggleButton.addEventListener("click", (e) => {
  e.preventDefault();
  if (socket.connected) {
    toggleButton.innerText = "Connect";
    socket.disconnect();
  } else {
    toggleButton.innerText = "Disconnect";
    socket.connect();
  }
});
